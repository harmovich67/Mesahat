/** Defaults for the Setting table. Admin settings overlay these. */
export const SETTINGS_DEFAULTS = {
  general: {
    business_name: { ar: 'ووركورا', en: 'WORKORA' },
    tagline: { ar: 'مساحتك للعمل. بطريقتك.', en: 'Your space. Your way.' },
    logo_url: '',
    email: 'hello@workora.example',
    phone: '+20 2 2796 1100',
    address: { ar: 'التجمع الخامس، القاهرة الجديدة', en: 'Fifth Settlement, New Cairo' },
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    tax_rate: 0, // percent, VAT-ready
    weekend_days: [5, 6], // Fri, Sat
  },
  booking: {
    min_duration_minutes: 60,
    max_duration_minutes: 720,
    slot_step_minutes: 30,
    half_day_hours: 4,
    payment_hold_minutes: 30,
    reupload_window_minutes: 180,
    advance_booking_days: 90,
    min_lead_minutes: 15,
    cancellation: {
      allowed_statuses: ['pending_payment', 'payment_under_review', 'confirmed'],
      tiers: [
        { hours_before: 48, refund_percent: 100 },
        { hours_before: 24, refund_percent: 50 },
        { hours_before: 0, refund_percent: 0 },
      ],
      fee_fixed: 0,
      fee_percent: 0,
    },
  },
  payment: {
    receipt_required: true,
    receipt_max_mb: 8,
    receipt_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    general_instructions: {
      ar: 'بعد التحويل، ارفع صورة إيصال التحويل واكتب وقت التحويل. سيتم مراجعة الدفع وتأكيد حجزك خلال دقائق.',
      en: 'After transferring, upload your transfer receipt and enter the transfer time. We will verify and confirm your booking within minutes.',
    },
  },
  notifications: {
    email_enabled: true,
    reminder_hours_before: 24,
    notify_admin_on_proof: true,
  },
  branding: {
    primary_color: '#1F4D3F',
    accent_color: '#C9803A',
  },
};
