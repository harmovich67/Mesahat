/**
 * Application errors. Every error exposed to clients carries a stable `code`
 * and a friendly Arabic `message`. Raw backend/DB errors are never leaked.
 */
export const ERRORS = {
  VALIDATION: [422, 'البيانات المدخلة غير صحيحة. برجاء مراجعتها.'],
  UNAUTHENTICATED: [401, 'برجاء تسجيل الدخول للمتابعة.'],
  INVALID_CREDENTIALS: [401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'],
  TOKEN_EXPIRED: [401, 'انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.'],
  ACCOUNT_SUSPENDED: [403, 'هذا الحساب موقوف. تواصل مع الدعم.'],
  FORBIDDEN: [403, 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'],
  NOT_FOUND: [404, 'العنصر المطلوب غير موجود.'],
  EMAIL_TAKEN: [409, 'هذا البريد الإلكتروني مسجل بالفعل.'],
  RATE_LIMITED: [429, 'محاولات كثيرة. برجاء المحاولة بعد قليل.'],

  SPACE_UNAVAILABLE: [409, 'المساحة غير متاحة في الوقت المحدد.'],
  SPACE_CLOSED: [409, 'المساحة مغلقة في هذا الوقت.'],
  SPACE_BLOCKED: [409, 'المساحة غير متاحة بسبب صيانة أو حجب مؤقت.'],
  OUTSIDE_HOURS: [409, 'الوقت المحدد خارج مواعيد العمل.'],
  PAST_TIME: [409, 'لا يمكن الحجز في وقت سابق.'],
  TOO_FAR_AHEAD: [409, 'التاريخ المحدد بعيد جدًا. الحد الأقصى للحجز المسبق تجاوزه.'],
  DURATION_INVALID: [422, 'مدة الحجز غير مسموح بها لهذه المساحة.'],
  UNIT_NOT_SUPPORTED: [422, 'نوع الحجز المحدد غير متاح لهذه المساحة.'],
  CAPACITY_EXCEEDED: [422, 'عدد الأشخاص أكبر من سعة المساحة.'],
  PRICE_CHANGED: [409, 'المبلغ تغير. برجاء مراجعة الحجز.'],
  ADDON_UNAVAILABLE: [422, 'إحدى الخدمات الإضافية غير متاحة.'],

  COUPON_INVALID: [422, 'كود الخصم غير صحيح.'],
  COUPON_EXPIRED: [422, 'كود الخصم منتهي أو لم يبدأ بعد.'],
  COUPON_LIMIT: [422, 'تم استنفاد عدد مرات استخدام كود الخصم.'],
  COUPON_USER_LIMIT: [422, 'لقد استخدمت هذا الكود الحد الأقصى من المرات.'],
  COUPON_MIN_AMOUNT: [422, 'قيمة الحجز أقل من الحد الأدنى لاستخدام الكود.'],
  COUPON_NOT_APPLICABLE: [422, 'كود الخصم لا ينطبق على هذه المساحة.'],

  BOOKING_EXPIRED: [410, 'انتهت مهلة الحجز.'],
  BOOKING_STATE: [409, 'لا يمكن تنفيذ هذا الإجراء في الحالة الحالية للحجز.'],
  CANCEL_NOT_ALLOWED: [409, 'لا يمكن إلغاء هذا الحجز وفقًا لسياسة الإلغاء.'],

  PAYMENT_METHOD_INVALID: [422, 'وسيلة الدفع غير متاحة.'],
  PAYMENT_STATE: [409, 'لا يمكن تنفيذ هذا الإجراء في الحالة الحالية للدفع.'],
  RECEIPT_REQUIRED: [422, 'يجب رفع صورة إثبات التحويل.'],
  RECEIPT_UPLOAD_FAILED: [400, 'حدث خطأ أثناء رفع الصورة.'],
  RECEIPT_TYPE: [415, 'نوع الملف غير مدعوم. المسموح: JPG, PNG, WEBP, PDF.'],
  RECEIPT_SIZE: [413, 'حجم الملف كبير جدًا.'],
  REASON_REQUIRED: [422, 'برجاء كتابة سبب القرار.'],

  REVIEW_NOT_ALLOWED: [409, 'يمكن التقييم فقط بعد اكتمال الحجز، ولمرة واحدة.'],
  DELETE_BLOCKED: [409, 'لا يمكن حذف هذا العنصر لوجود بيانات مرتبطة به. يمكنك أرشفته بدلاً من ذلك.'],
  INTERNAL: [500, 'حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.'],
};

export class AppError extends Error {
  constructor(code, { message, details, status } = {}) {
    const [defStatus, defMessage] = ERRORS[code] || ERRORS.INTERNAL;
    super(message || defMessage);
    this.code = code;
    this.status = status || defStatus;
    this.details = details;
    this.expose = true;
  }
}

export const fail = (code, opts) => {
  throw new AppError(code, opts);
};
