/** Shapes DB rows into public API payloads. No business logic here. */
const num = (v) => (v == null ? null : Number(v));

export function serializeSpaceCard(s) {
  const prices = (s.pricing || []).filter((p) => p.kind === 'base' && p.active);
  const cover = (s.images || []).slice().sort((a, b) => a.sort - b.sort)[0];
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    capacity: s.capacity,
    units: s.units,
    area_sqm: s.area_sqm,
    floor: s.floor,
    featured: s.featured,
    status: s.status,
    currency: s.currency,
    rating_avg: num(s.rating_avg),
    rating_count: s.rating_count,
    cover: cover?.url || null,
    type: s.type && { id: s.type.id, key: s.type.key, group: s.type.group, name: s.type.name, color: s.type.color, icon: s.type.icon },
    location: s.location && { id: s.location.id, slug: s.location.slug, name: s.location.name, city: s.location.city },
    amenities: (s.amenities || []).map((a) => ({ id: a.id, key: a.key, name: a.name, icon: a.icon })),
    prices: prices.map((p) => ({ unit: p.unit, amount: num(p.amount) })),
  };
}

export function serializeSpaceDetail(s) {
  return {
    ...serializeSpaceCard(s),
    rules: s.rules,
    images: (s.images || []).slice().sort((a, b) => a.sort - b.sort).map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
    pricing: (s.pricing || []).map((p) => ({ id: p.id, unit: p.unit, kind: p.kind, amount: num(p.amount), peak_start: p.peak_start, peak_end: p.peak_end, active: p.active })),
    hours: (s.hours || []).slice().sort((a, b) => a.weekday - b.weekday).map((h) => ({ weekday: h.weekday, opens: h.opens, closes: h.closes, is_closed: h.is_closed })),
    location: s.location && {
      id: s.location.id, slug: s.location.slug, name: s.location.name, city: s.location.city, address: s.location.address,
      latitude: num(s.location.latitude), longitude: num(s.location.longitude), phone: s.location.phone,
    },
  };
}

export function serializePayment(p, { includeReceipt = true } = {}) {
  if (!p) return null;
  const receipts = p.receipts || [];
  const current = receipts.find((r) => r.is_current);
  return {
    id: p.id,
    booking_id: p.booking_id,
    method: p.method,
    amount: num(p.amount),
    currency: p.currency,
    status: p.status,
    transfer_reference: p.transfer_reference,
    transfer_time: p.transfer_time,
    sender_info: p.sender_info,
    submitted_at: p.submitted_at,
    reviewed_at: p.reviewed_at,
    reviewer_name: p.reviewer?.name || null,
    rejection_reason: p.rejection_reason,
    needs_new_receipt: p.needs_new_receipt,
    refund_amount: num(p.refund_amount),
    refunded_at: p.refunded_at,
    has_receipt: !!current,
    receipt: includeReceipt && current
      ? { id: current.id, original_name: current.original_name, mime_type: current.mime_type, file_size: current.file_size, uploaded_at: (current.createdAt ?? current.created_at) }
      : null,
    receipt_history_count: receipts.length,
  };
}

export function serializeBooking(b, { admin = false } = {}) {
  const out = {
    id: b.id,
    booking_number: b.booking_number,
    status: b.status,
    unit: b.unit,
    start_at: b.start_at,
    end_at: b.end_at,
    duration_minutes: b.duration_minutes,
    guest_count: b.guest_count,
    base_amount: num(b.base_amount),
    addon_amount: num(b.addon_amount),
    discount_amount: num(b.discount_amount),
    tax_amount: num(b.tax_amount),
    final_amount: num(b.final_amount),
    currency: b.currency,
    coupon_code: b.coupon_code,
    hold_expires_at: b.hold_expires_at,
    notes: b.notes,
    source: b.source,
    cancelled_at: b.cancelled_at,
    cancel_reason: b.cancel_reason,
    refund_amount: num(b.refund_amount),
    created_at: (b.createdAt ?? b.created_at),
    space: b.space && {
      id: b.space.id, slug: b.space.slug, name: b.space.name, capacity: b.space.capacity,
      cover: (b.space.images || []).slice().sort((x, y) => x.sort - y.sort)[0]?.url || null,
      type: b.space.type && { key: b.space.type.key, name: b.space.type.name, color: b.space.type.color },
    },
    location: b.location && {
      id: b.location.id, slug: b.location.slug, name: b.location.name, address: b.location.address, city: b.location.city,
      latitude: num(b.location.latitude), longitude: num(b.location.longitude), phone: b.location.phone,
    },
    payment: serializePayment(b.payment),
    addons: (b.addons || []).map((a) => ({ id: a.id, name: a.name, quantity: a.quantity, unit_price: num(a.unit_price), total: num(a.total) })),
    guests: (b.guests || []).map((g) => ({ id: g.id, name: g.name, email: g.email, phone: g.phone })),
    events: (b.events || []).slice().sort((x, y) => new Date((x.createdAt ?? x.created_at)) - new Date((y.createdAt ?? y.created_at)))
      .map((e) => ({ id: e.id, type: e.type, at: (e.createdAt ?? e.created_at), actor: admin ? e.actor?.name || null : null, meta: e.meta })),
    review: b.review ? { id: b.review.id, rating: b.review.rating, status: b.review.status } : null,
  };
  if (admin && b.customer) {
    out.customer = { id: b.customer.id, name: b.customer.name, email: b.customer.email, phone: b.customer.phone };
  }
  return out;
}

export const serializeUser = (u, { permissions } = {}) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  locale: u.locale,
  avatar_url: u.avatar_url,
  company: u.company,
  is_staff: u.is_staff,
  status: u.status,
  roles: (u.roles || []).map((r) => ({ id: r.id, key: r.key, name: r.name })),
  ...(permissions ? { permissions } : {}),
  created_at: (u.createdAt ?? u.created_at),
  last_login_at: u.last_login_at,
});
