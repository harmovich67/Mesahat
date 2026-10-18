import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';

import { useAuthStore } from './store/authStore';
import { useLanguageStore } from './store/languageStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullScreenLoader, PageLoader } from './components/ui/Feedback';

// Layouts are tiny and always needed for their route group.
import { CustomerLayout } from './components/layout/CustomerLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Every page is its own chunk — keeps three.js / fullcalendar / recharts off the landing page.
const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const Home = page(() => import('./pages/Home'), 'Home');
const Spaces = page(() => import('./pages/Spaces'), 'Spaces');
const SpaceDetail = page(() => import('./pages/SpaceDetail'), 'SpaceDetail');
const Locations = page(() => import('./pages/Locations'), 'Locations');
const Pricing = page(() => import('./pages/Pricing'), 'Pricing');
const About = page(() => import('./pages/About'), 'About');
const Contact = page(() => import('./pages/Contact'), 'Contact');
const Login = page(() => import('./pages/Login'), 'Login');
const Register = page(() => import('./pages/Register'), 'Register');

const CustomerDashboard = page(() => import('./pages/customer/CustomerDashboard'), 'CustomerDashboard');
const MyBookings = page(() => import('./pages/customer/MyBookings'), 'MyBookings');
const BookingDetail = page(() => import('./pages/customer/BookingDetail'), 'BookingDetail');
const Profile = page(() => import('./pages/customer/Profile'), 'Profile');
const Notifications = page(() => import('./pages/customer/Notifications'), 'Notifications');

const AdminOverview = page(() => import('./pages/admin/AdminOverview'), 'AdminOverview');
const AdminPaymentVerification = page(() => import('./pages/admin/AdminPaymentVerification'), 'AdminPaymentVerification');
const AdminBookings = page(() => import('./pages/admin/AdminBookings'), 'AdminBookings');
const AdminSpaces = page(() => import('./pages/admin/AdminSpaces'), 'AdminSpaces');
const AdminOccupancy = page(() => import('./pages/admin/AdminOccupancy'), 'AdminOccupancy');
const AdminReports = page(() => import('./pages/admin/AdminReports'), 'AdminReports');
const AdminCoupons = page(() => import('./pages/admin/AdminCoupons'), 'AdminCoupons');
const AdminCustomers = page(() => import('./pages/admin/AdminCustomers'), 'AdminCustomers');
const AdminAuditLogs = page(() => import('./pages/admin/AdminAuditLogs'), 'AdminAuditLogs');
const AdminSettings = page(() => import('./pages/admin/AdminSettings'), 'AdminSettings');

function Guard({ children, staffOnly = false, loginRedirect }) {
  const { isAuthenticated, isStaff, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to={`/login?redirect=${encodeURIComponent(loginRedirect)}`} replace />;
  if (staffOnly && !isStaff) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Notification links created by the server point at /account/* — map them onto the customer dashboard. */
function AccountRedirect() {
  const { '*': rest } = useParams();
  return <Navigate to={`/dashboard${rest ? `/${rest}` : ''}`} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/spaces" element={<Spaces />} />
          <Route path="/spaces/:slug" element={<SpaceDetail />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/dashboard"
            element={
              <Guard loginRedirect="/dashboard">
                <CustomerLayout />
              </Guard>
            }
          >
            <Route index element={<CustomerDashboard />} />
            <Route path="bookings" element={<MyBookings />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          <Route path="/account/*" element={<AccountRedirect />} />

          <Route
            path="/admin"
            element={
              <Guard staffOnly loginRedirect="/admin">
                <AdminLayout />
              </Guard>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="payments" element={<AdminPaymentVerification />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="spaces" element={<AdminSpaces />} />
            <Route path="occupancy" element={<AdminOccupancy />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="audit" element={<AdminAuditLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const dir = useLanguageStore((s) => s.dir);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />
      <Toaster
        position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
        dir={dir}
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </BrowserRouter>
  );
}

export default App;
