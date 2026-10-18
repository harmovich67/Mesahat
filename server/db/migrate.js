import { sequelize } from '../models/index.js';

/**
 * Creates tables and the database-level safety nets that the application
 * relies on. Idempotent. In a larger team this would be split into versioned
 * Umzug migrations; the SQL below is intentionally plain so it ports 1:1.
 */
export async function migrate({ force = false } = {}) {
  // btree_gist lets us combine "=" on uuid/int with "&&" on time ranges.
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
  if (force) await sequelize.drop({ cascade: true });
  await sequelize.sync();

  await sequelize.query('CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 10280');

  // HARD GUARANTEE: two blocking bookings can never overlap on the same unit of the same space,
  // even if application code has a bug or two requests race each other.
  await sequelize.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
          EXCLUDE USING gist (
            space_id WITH =,
            unit_slot WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
          ) WHERE (status IN ('pending_payment','payment_under_review','confirmed','active'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_time_order') THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_time_order CHECK (end_at > start_at);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocked_periods_time_order') THEN
        ALTER TABLE blocked_periods ADD CONSTRAINT blocked_periods_time_order CHECK (end_at > start_at);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_amounts_nonneg') THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_amounts_nonneg
          CHECK (final_amount >= 0 AND base_amount >= 0 AND discount_amount >= 0);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_range') THEN
        ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
      END IF;
    END $$;
  `);
  // Only one *current* receipt per payment.
  await sequelize.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_one_current ON payment_receipts (payment_id) WHERE is_current',
  );
}

export async function nextBookingNumber(transaction) {
  const [[row]] = await sequelize.query("SELECT nextval('booking_number_seq') AS n", { transaction });
  return `BK-${row.n}`;
}
