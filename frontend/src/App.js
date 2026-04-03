import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { RateLimitProvider, useRateLimit } from './contexts/RateLimitContext';
import { setRateLimitContext } from './utils/apiInterceptor';
import TrackingRoute from './components/TrackingRoute';
import AppLayout from './components/AppLayout';
import RateLimitBanner from './components/RateLimitBanner';
import Login from './pages/Login';
import ChildLogin from './pages/ChildLogin';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Gymnasts from './pages/Gymnasts';
import Levels from './pages/Levels';
import Competitions from './pages/Competitions';
import Progress from './pages/Progress';
import MyProgress from './pages/MyProgress';
import Certificates from './pages/Certificates';
import CertificateDesigner from './pages/CertificateDesigner';
import CertificatePreview from './pages/CertificatePreview';
import ClubSettings from './pages/ClubSettings';
import Branding from './pages/Branding';
import MyCertificates from './pages/MyCertificates';
import Health from './pages/Health';
import SuperAdmin from './pages/SuperAdmin';
import Cheatsheets from './pages/Cheatsheets';
import CheatsheetViewer from './pages/CheatsheetViewer';
import WaveLength from './pages/WaveLength';
import BookingCalendar from './pages/booking/BookingCalendar';
import Cart from './pages/booking/Cart';
import CartConfirmation from './pages/booking/CartConfirmation';
import SessionDetail from './pages/booking/SessionDetail';
import Checkout from './pages/booking/Checkout';
import BookingConfirmation from './pages/booking/BookingConfirmation';
import MyBookings from './pages/booking/MyBookings';
import MyWaitlist from './pages/booking/MyWaitlist';
import MyChildren from './pages/booking/MyChildren';
import BookingAdmin from './pages/booking/admin/BookingAdmin';
import AdminClosures from './pages/booking/admin/AdminClosures';
import SessionManagement from './pages/booking/admin/SessionTemplates';
import AdminMembers from './pages/booking/admin/AdminMembers';
import AdminMessages from './pages/booking/admin/AdminMessages';
import AdminBgNumbers from './pages/booking/admin/AdminBgNumbers';
import AuditLog from './pages/booking/admin/AuditLog';
import ShopListing from './pages/booking/shop/ShopListing';
import ShopProduct from './pages/booking/shop/ShopProduct';
import ShopConfirmation from './pages/booking/shop/ShopConfirmation';
import MyOrders from './pages/booking/shop/MyOrders';
import MyCharges from './pages/booking/MyCharges';
import Noticeboard from './pages/booking/Noticeboard';
import HelpPage from './pages/booking/HelpPage';
import AdminShopOrders from './pages/booking/admin/AdminShopOrders';
import AdminRecipientGroups from './pages/booking/admin/AdminRecipientGroups';
import AdminCharges from './pages/booking/admin/AdminCharges';
import AdminCredits from './pages/booking/admin/AdminCredits';
import AdminMemberships from './pages/booking/admin/AdminMemberships';
import AdminPayments from './pages/booking/admin/AdminPayments';
import AdminHelpPage from './pages/booking/admin/AdminHelpPage';
import AdminRegister from './pages/booking/admin/AdminRegister';
import AdminDashboard from './pages/AdminDashboard';
import ScrollToTop from './components/ScrollToTop';
import PublicHome from './pages/public/PublicHome';
import PublicPolicies from './pages/public/PublicPolicies';
import './App.css';

function PageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const favicon = document.getElementById('favicon');
    if (pathname.startsWith('/cheatsheets')) {
      document.title = '2026 BG Rules Cheatsheets - Trampoline & DMT | British Gymnastics';
      if (favicon) favicon.href = '/favicon.png';
    } else if (pathname.startsWith('/booking')) {
      document.title = 'Booking | Trampoline Life';
      if (favicon) favicon.href = '/tl-favicon.png';
    } else if (
      pathname === '/' ||
      pathname.startsWith('/gymnasts') ||
      pathname.startsWith('/levels') ||
      pathname.startsWith('/competitions') ||
      pathname.startsWith('/progress') ||
      pathname.startsWith('/my-progress') ||
      pathname.startsWith('/certificates') ||
      pathname.startsWith('/my-certificates') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/club-settings') ||
      pathname.startsWith('/branding')
    ) {
      document.title = 'Tracker | Trampoline Life';
      if (favicon) favicon.href = '/tl-favicon.png';
    } else {
      document.title = 'Trampoline Life';
      if (favicon) favicon.href = '/tl-favicon.png';
    }
  }, [pathname]);

  return null;
}

// Inner component to access rate limit context
function AppContent() {
  const rateLimitContext = useRateLimit();

  useEffect(() => {
    // Set up the API interceptor with rate limit context
    setRateLimitContext(rateLimitContext);

    // Add body class when rate limited for layout adjustments
    const updateBodyClass = () => {
      if (rateLimitContext.isRateLimited) {
        document.body.classList.add('rate-limited');
      } else {
        document.body.classList.remove('rate-limited');
      }
    };

    updateBodyClass();

    // In development mode, expose rate limit testing function to console
    if (process.env.NODE_ENV === 'development') {
      window.testRateLimit = (seconds = 10) => {
        console.log('🧪 Testing rate limit banner...');
        rateLimitContext.triggerRateLimitForTesting(seconds);
      };
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('rate-limited');
      if (process.env.NODE_ENV === 'development') {
        delete window.testRateLimit;
      }
    };
  }, [rateLimitContext]);

  return (
    <div className="App">
      <ScrollToTop />
      <PageMeta />
      <RateLimitBanner />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicHome />} />
        <Route path="/policies" element={<PublicPolicies />} />
        <Route path="/login" element={<Login />} />
        <Route path="/child-login" element={<ChildLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/cheatsheets" element={<Cheatsheets />} />
        <Route path="/cheatsheets/:cheatsheetId" element={<CheatsheetViewer />} />
        <Route path="/wavelength" element={<WaveLength />} />

        {/* All authenticated routes under AppLayout */}
        <Route element={<AppLayout />}>
          {/* Universal — all authenticated roles */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Navigate to="/booking/my-account" replace />} />
          <Route path="my-progress" element={<MyProgress />} />
          <Route path="my-certificates" element={<MyCertificates />} />
          <Route path="health" element={<Health />} />
          <Route path="super-admin" element={<SuperAdmin />} />

          {/* Staff-only tracking routes */}
          <Route element={<TrackingRoute />}>
            <Route path="admin-hub" element={<AdminDashboard />} />
            <Route path="gymnasts" element={<Gymnasts />} />
            <Route path="levels" element={<Levels />} />
            <Route path="competitions" element={<Competitions />} />
            <Route path="progress/:gymnastId" element={<Progress />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="certificates/:certificateId/preview" element={<CertificatePreview />} />
            <Route path="certificate-designer" element={<CertificateDesigner />} />
            <Route path="club-settings" element={<ClubSettings />} />
            <Route path="branding" element={<Branding />} />
          </Route>

          {/* Booking routes */}
          <Route path="booking">
            <Route index element={<BookingCalendar />} />
            <Route path="session/:instanceId" element={<SessionDetail />} />
            <Route path="checkout/:bookingId" element={<Checkout />} />
            <Route path="cart" element={<Cart />} />
            <Route path="cart-confirmation" element={<CartConfirmation />} />
            <Route path="cart-checkout" element={<Navigate to="/booking/cart" replace />} />
            <Route path="confirmation/:bookingId" element={<BookingConfirmation />} />
            <Route path="my-bookings" element={<MyBookings />} />
            <Route path="my-waitlist" element={<MyWaitlist />} />
            <Route path="my-account" element={<MyChildren />} />
            <Route path="admin" element={<BookingAdmin />} />
            <Route path="admin/closures" element={<AdminClosures />} />
            <Route path="admin/session-management" element={<SessionManagement />} />
            <Route path="admin/members" element={<AdminMembers />} />
            <Route path="admin/messages" element={<AdminMessages />} />
            <Route path="admin/bg-numbers" element={<AdminBgNumbers />} />
            <Route path="admin/audit-log" element={<AuditLog />} />
            <Route path="shop" element={<ShopListing />} />
            <Route path="shop/cart" element={<Navigate to="/booking/cart" replace />} />
            <Route path="shop/:productId" element={<ShopProduct />} />
            <Route path="shop/confirmation/:orderId" element={<ShopConfirmation />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="my-charges" element={<MyCharges />} />
            <Route path="noticeboard" element={<Noticeboard />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="admin/shop-orders" element={<AdminShopOrders />} />
            <Route path="admin/recipient-groups" element={<AdminRecipientGroups />} />
            <Route path="admin/charges" element={<AdminCharges />} />
            <Route path="admin/credits" element={<AdminCredits />} />
            <Route path="admin/memberships" element={<AdminMemberships />} />
            <Route path="admin/payments" element={<AdminPayments />} />
            <Route path="admin/help" element={<AdminHelpPage />} />
            <Route path="admin/register/:instanceId" element={<AdminRegister />} />
          </Route>
        </Route>
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <RateLimitProvider>
          <AppContent />
        </RateLimitProvider>
      </AuthProvider>
    </BrandingProvider>
  );
}

export default App;
