/** Granular permission catalogue + default role bundles. */
export const PERMISSIONS = {
  bookings: ['bookings.view', 'bookings.create', 'bookings.edit', 'bookings.cancel'],
  payments: ['payments.view', 'payments.review', 'payments.refund'],
  spaces: ['spaces.view', 'spaces.create', 'spaces.edit', 'spaces.delete'],
  catalog: ['locations.manage', 'amenities.manage', 'addons.manage', 'coupons.manage'],
  customers: ['customers.view', 'reviews.moderate'],
  reports: ['reports.view'],
  system: ['users.manage', 'roles.manage', 'settings.manage', 'audit.view', 'notifications.send'],
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();

const pick = (...keys) => keys;

export const ROLE_DEFS = [
  { key: 'owner', name: { ar: 'المالك', en: 'Owner' }, permissions: ['*'] },
  { key: 'super_admin', name: { ar: 'مدير عام', en: 'Super Admin' }, permissions: ALL_PERMISSIONS.filter((p) => p !== 'roles.manage') },
  {
    key: 'admin', name: { ar: 'مدير', en: 'Admin' },
    permissions: ALL_PERMISSIONS.filter((p) => !['roles.manage', 'users.manage', 'settings.manage'].includes(p)),
  },
  {
    key: 'booking_manager', name: { ar: 'مدير الحجوزات', en: 'Booking Manager' },
    permissions: pick('bookings.view', 'bookings.create', 'bookings.edit', 'bookings.cancel', 'spaces.view', 'customers.view', 'payments.view'),
  },
  {
    key: 'payment_reviewer', name: { ar: 'مراجع المدفوعات', en: 'Payment Reviewer' },
    permissions: pick('bookings.view', 'payments.view', 'payments.review', 'customers.view'),
  },
  {
    key: 'space_manager', name: { ar: 'مدير المساحات', en: 'Space Manager' },
    permissions: pick('spaces.view', 'spaces.create', 'spaces.edit', 'spaces.delete', 'locations.manage', 'amenities.manage', 'addons.manage', 'bookings.view'),
  },
  {
    key: 'support_agent', name: { ar: 'خدمة العملاء', en: 'Support Agent' },
    permissions: pick('bookings.view', 'bookings.create', 'bookings.edit', 'customers.view', 'reviews.moderate', 'spaces.view', 'notifications.send'),
  },
  {
    key: 'accountant', name: { ar: 'المحاسب', en: 'Accountant' },
    permissions: pick('payments.view', 'payments.refund', 'reports.view', 'bookings.view', 'customers.view'),
  },
  {
    key: 'viewer', name: { ar: 'مشاهد', en: 'Viewer' },
    permissions: pick('bookings.view', 'payments.view', 'spaces.view', 'customers.view', 'reports.view'),
  },
];

export const PERMISSION_LABELS = {
  'bookings.view': 'عرض الحجوزات', 'bookings.create': 'إنشاء حجز', 'bookings.edit': 'تعديل الحجوزات', 'bookings.cancel': 'إلغاء الحجوزات',
  'payments.view': 'عرض المدفوعات', 'payments.review': 'مراجعة المدفوعات', 'payments.refund': 'معالجة الاسترداد',
  'spaces.view': 'عرض المساحات', 'spaces.create': 'إنشاء مساحات', 'spaces.edit': 'تعديل المساحات', 'spaces.delete': 'حذف المساحات',
  'locations.manage': 'إدارة الفروع', 'amenities.manage': 'إدارة المرافق', 'addons.manage': 'إدارة الخدمات الإضافية', 'coupons.manage': 'إدارة الكوبونات',
  'customers.view': 'عرض العملاء', 'reviews.moderate': 'إدارة التقييمات', 'reports.view': 'عرض التقارير',
  'users.manage': 'إدارة الفريق', 'roles.manage': 'إدارة الأدوار', 'settings.manage': 'إدارة الإعدادات',
  'audit.view': 'عرض سجل المراجعة', 'notifications.send': 'إرسال الإشعارات',
};
