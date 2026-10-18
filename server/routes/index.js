import { Router } from 'express';
import * as authC from '../controllers/auth.js';
import * as pub from '../controllers/public.js';
import * as cust from '../controllers/customer.js';
import * as ops from '../controllers/admin/operations.js';
import * as mgmt from '../controllers/admin/management.js';
import {
  authenticate, optionalAuth, requirePermission as need, requireAnyPermission as needAny, requireStaff, validate, wrap,
  csrfGuard, authLimiter, uploadLimiter, upload,
} from '../middleware/index.js';
import * as v from '../validators/index.js';

const w = wrap;
export const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, service: 'workora-api', time: new Date().toISOString() }));

/* ---------------------------------- auth ---------------------------------- */
const auth = Router();
auth.post('/register', authLimiter, validate(v.registerSchema), w(authC.register));
auth.post('/login', authLimiter, validate(v.loginSchema), w(authC.login));
auth.post('/refresh', csrfGuard, w(authC.refresh));
auth.post('/logout', csrfGuard, w(authC.logout));
auth.get('/me', authenticate, w(authC.me));
auth.patch('/me', authenticate, validate(v.profileSchema), w(authC.updateMe));
auth.post('/change-password', authenticate, authLimiter, validate(v.changePasswordSchema), w(authC.changePassword));
api.use('/auth', auth);

/* ---------------------------------- public ---------------------------------- */
api.get('/settings/public', w(pub.settings));
api.get('/space-types', w(pub.spaceTypes));
api.get('/locations', w(pub.locations));
api.get('/locations/:slug', w(pub.locationDetail));
api.get('/amenities', w(pub.amenities));
api.get('/addons', w(pub.addOns));
api.get('/payment-methods', w(pub.paymentMethods));
api.get('/featured-reviews', w(pub.featuredReviews));
api.get('/spaces', validate(v.spaceQuerySchema, 'query'), w(pub.listSpaces));
api.get('/spaces/match', validate(v.matchQuerySchema, 'query'), w(pub.match));
api.get('/spaces/:id', w(pub.spaceDetail));
api.get('/spaces/:id/availability', validate(v.availabilityQuerySchema, 'query'), w(pub.availability));
api.post('/contact', authLimiter, validate(v.contactSchema), w(pub.contact));
api.post('/bookings/quote', optionalAuth, validate(v.bookingInputSchema), w(pub.quote));

/* ---------------------------------- customer ---------------------------------- */
api.get('/bookings', authenticate, w(cust.list));
api.post('/bookings', authenticate, validate(v.bookingInputSchema), w(cust.create));
api.get('/bookings/rebook-suggestions', authenticate, w(cust.rebook));
api.get('/bookings/:id', authenticate, w(cust.get));
api.get('/bookings/:id/cancellation-quote', authenticate, w(cust.quoteCancel));
api.post('/bookings/:id/payment', authenticate, validate(v.selectMethodSchema), w(cust.choosePayment));
api.post('/bookings/:id/cancel', authenticate, validate(v.cancelSchema), w(cust.cancel));

api.get('/payments', authenticate, w(cust.paymentHistory));
api.post('/payments/:id/receipt', authenticate, uploadLimiter, upload.single('receipt'), w(cust.receipt));
api.post('/payments/:id/submit', authenticate, validate(v.submitPaymentSchema), w(cust.submit));
api.get('/payments/:id/receipt', authenticate, w(cust.downloadReceipt));

api.get('/favorites', authenticate, w(cust.favorites));
api.post('/favorites/:spaceId', authenticate, w(cust.toggleFavorite));
api.get('/notifications', authenticate, w(cust.notifications));
api.post('/notifications/read-all', authenticate, w(cust.readAllNotifications));
api.post('/notifications/:id/read', authenticate, w(cust.readNotification));
api.post('/reviews', authenticate, validate(v.reviewSchema), w(cust.createReview));
api.get('/reviews/mine', authenticate, w(cust.myReviews));
api.post('/uploads/image', authenticate, uploadLimiter, upload.single('image'), w(cust.uploadPublicImage));

/* ---------------------------------- admin ---------------------------------- */
const admin = Router();
admin.use(authenticate, requireStaff);

admin.get('/dashboard', w(ops.dashboard));
admin.get('/reports', need('reports.view'), validate(v.rangeQuerySchema, 'query'), w(ops.reportsOverview));
admin.get('/search', w(ops.search));
admin.get('/audit-logs', need('audit.view'), validate(v.listQuerySchema, 'query'), w(ops.auditList));

// bookings & calendar
admin.get('/bookings', need('bookings.view'), validate(v.listQuerySchema, 'query'), w(ops.bookingsList));
admin.post('/bookings', need('bookings.create'), validate(v.adminBookingSchema), w(ops.bookingCreateManual));
admin.get('/bookings/:id', need('bookings.view'), w(ops.bookingGet));
admin.patch('/bookings/:id', need('bookings.edit'), validate(v.bookingPatchSchema), w(ops.bookingPatch));
admin.post('/bookings/:id/cancel', need('bookings.cancel'), validate(v.cancelSchema), w(ops.bookingCancel));
admin.get('/calendar', need('bookings.view'), validate(v.listQuerySchema, 'query'), w(ops.calendar));
admin.post('/blocks', needAny('spaces.edit', 'bookings.edit'), validate(v.blockSchema), w(ops.blockCreate));
admin.delete('/blocks/:id', needAny('spaces.edit', 'bookings.edit'), w(ops.blockDelete));

// payment verification
admin.get('/payments', need('payments.view'), validate(v.listQuerySchema, 'query'), w(ops.paymentsList));
admin.get('/payments/pending', need('payments.view'), (req, _res, next) => { req.query.status = 'under_review'; next(); }, validate(v.listQuerySchema, 'query'), w(ops.paymentsList));
admin.get('/payments/:id', need('payments.view'), w(ops.paymentGet));
admin.get('/payments/:id/receipt', need('payments.view'), w(cust.downloadReceipt));
admin.post('/payments/:id/approve', need('payments.review'), validate(v.noteSchema), w(ops.paymentApprove));
admin.post('/payments/:id/reject', need('payments.review'), validate(v.reasonSchema), w(ops.paymentReject));
admin.post('/payments/:id/request-new-receipt', need('payments.review'), validate(v.reasonSchema), w(ops.paymentRequestNew));
admin.post('/payments/:id/refund', need('payments.refund'), w(ops.paymentRefund));

// spaces
admin.get('/spaces', need('spaces.view'), w(mgmt.spacesList));
admin.post('/spaces', need('spaces.create'), validate(v.spaceSchema), w(mgmt.spaceCreate));
admin.get('/spaces/:id', need('spaces.view'), w(mgmt.spaceGet));
admin.put('/spaces/:id', need('spaces.edit'), validate(v.spacePatchSchema), w(mgmt.spaceUpdate));
admin.patch('/spaces/:id', need('spaces.edit'), validate(v.spacePatchSchema), w(mgmt.spaceUpdate));
admin.post('/spaces/:id/status', need('spaces.edit'), validate(v.statusSchema), w(mgmt.spaceStatus));
admin.post('/spaces/:id/duplicate', need('spaces.create'), w(mgmt.spaceDuplicate));
admin.delete('/spaces/:id', need('spaces.delete'), w(mgmt.spaceDelete));
admin.post('/uploads/image', upload.single('image'), uploadLimiter, w(mgmt.uploadImage));

const mountCrud = (path, ctrl, schema, readPerm, writePerm, { partialUpdate = true } = {}) => {
  admin.get(path, needAny(readPerm, writePerm), w(ctrl.list));
  admin.get(`${path}/:id`, needAny(readPerm, writePerm), w(ctrl.get));
  admin.post(path, need(writePerm), validate(schema), w(ctrl.create));
  admin.put(`${path}/:id`, need(writePerm), validate(partialUpdate ? schema.partial() : schema), w(ctrl.update));
  admin.delete(`${path}/:id`, need(writePerm), w(ctrl.remove));
};
mountCrud('/locations', mgmt.locationsCrud, v.locationSchema, 'spaces.view', 'locations.manage');
mountCrud('/space-types', mgmt.spaceTypesCrud, v.spaceTypeSchema, 'spaces.view', 'spaces.edit');
mountCrud('/amenities', mgmt.amenitiesCrud, v.amenitySchema, 'spaces.view', 'amenities.manage');
mountCrud('/addons', mgmt.addOnsCrud, v.addOnSchema, 'spaces.view', 'addons.manage');
mountCrud('/coupons', mgmt.couponsCrud, v.couponSchema, 'coupons.manage', 'coupons.manage', { partialUpdate: false });

// customers & reviews
admin.get('/customers', need('customers.view'), validate(v.listQuerySchema, 'query'), w(ops.customersList));
admin.get('/customers/:id', need('customers.view'), w(ops.customerGet));
admin.post('/customers/:id/status', need('users.manage'), w(ops.customerStatus));
admin.get('/reviews', need('reviews.moderate'), w(ops.reviewsList));
admin.patch('/reviews/:id', need('reviews.moderate'), w(ops.reviewModerate));
admin.delete('/reviews/:id', need('reviews.moderate'), w(ops.reviewDelete));
admin.post('/messages', need('notifications.send'), validate(v.messageSchema), w(mgmt.sendMessage));

// settings, payment methods, team & roles
admin.get('/settings', need('settings.manage'), w(mgmt.settingsGet));
admin.patch('/settings', need('settings.manage'), validate(v.settingsPatchSchema), w(mgmt.settingsUpdate));
admin.get('/payment-methods', needAny('settings.manage', 'payments.view'), w(mgmt.paymentMethodsList));
admin.put('/payment-methods/:code', need('settings.manage'), validate(v.paymentMethodSchema), w(mgmt.paymentMethodUpdate));
admin.get('/team', needAny('users.manage', 'roles.manage'), w(mgmt.teamList));
admin.post('/team', need('users.manage'), validate(v.teamMemberSchema), w(mgmt.teamCreate));
admin.patch('/team/:id', need('users.manage'), validate(v.teamPatchSchema), w(mgmt.teamUpdate));
admin.get('/roles', needAny('users.manage', 'roles.manage'), w(mgmt.rolesList));
admin.post('/roles', need('roles.manage'), validate(v.roleSchema), w(mgmt.roleCreate));
admin.patch('/roles/:id', need('roles.manage'), validate(v.rolePatchSchema), w(mgmt.roleUpdate));
admin.delete('/roles/:id', need('roles.manage'), w(mgmt.roleDelete));

api.use('/admin', admin);
