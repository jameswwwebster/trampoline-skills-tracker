import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { RateLimitProvider, useRateLimit } from './contexts/RateLimitContext';
import { setRateLimitContext } from './utils/apiInterceptor';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
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
import Invites from './pages/Invites';

import Users from './pages/Users';
import Profile from './pages/Profile';
import Certificates from './pages/Certificates';
import CertificateDesigner from './pages/CertificateDesigner';
import CertificatePreview from './pages/CertificatePreview';
import ImportGymnasts from './pages/ImportGymnasts';
import AcceptInvite from './pages/AcceptInvite';
import ClubSettings from './pages/ClubSettings';
import Branding from './pages/Branding';
import ParentConnectionRequest from './pages/ParentConnectionRequest';
import ParentRequests from './pages/ParentRequests';
import CustomFields from './pages/CustomFields';
import MyCertificates from './pages/MyCertificates';
import Health from './pages/Health';
import SuperAdmin from './pages/SuperAdmin';
import Cheatsheets from './pages/Cheatsheets';
import CheatsheetViewer from './pages/CheatsheetViewer';
import WaveLength from './pages/WaveLength';
import BookingLayout from './pages/booking/BookingLayout';
import BookingCalendar from './pages/booking/BookingCalendar';
import CartCheckout from './pages/booking/CartCheckout';
import Cart from './pages/booking/Cart';
import CartConfirmation from './pages/booking/CartConfirmation';
import SessionDetail from './pages/booking/SessionDetail';
import Checkout from './pages/booking/Checkout';
import BookingConfirmation from './pages/booking/BookingConfirmation';
import MyBookings from './pages/booking/MyBookings';
import MyChildren from './pages/booking/MyChildren';
import BookingAdmin from './pages/booking/admin/BookingAdmin';
import AdminClosures from './pages/booking/admin/AdminClosures';
import AdminMembers from './pages/booking/admin/AdminMembers';
import AdminMessages from './pages/booking/admin/AdminMessages';
import AdminBgNumbers from './pages/booking/admin/AdminBgNumbers';
import AuditLog from './pages/booking/admin/AuditLog';
import ShopListing from './pages/booking/shop/ShopListing';
import ShopProduct from './pages/booking/shop/ShopProduct';
import ShopCart from './pages/booking/shop/ShopCart';
import ShopConfirmation from './pages/booking/shop/ShopConfirmation';
import MyOrders from './pages/booking/shop/MyOrders';
import MyCharges from './pages/booking/MyCharges';
import Noticeboard from './pages/booking/Noticeboard';
import AdminShopOrders from './pages/booking/admin/AdminShopOrders';
import AdminRecipientGroups from './pages/booking/admin/AdminRecipientGroups';
import AdminCharges from './pages/booking/admin/AdminCharges';
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
      pathname.startsWith('/users') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/invites') ||
      pathname.startsWith('/import') ||
      pathname.startsWith('/club-settings') ||
      pathname.startsWith('/branding') ||
      pathname.startsWith('/custom-fields') ||
      pathname.startsWith('/parent-requests')
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
      <PageMeta />
      <RateLimitBanner />
      <Routes>
        {/* Public website routes — no authentication required */}
        <Route path="/" element={<PublicHome />} />
        <Route path="/policies" element={<PublicPolicies />} />
        <Route path="/login" element={<Login />} />
        <Route path="/child-login" element={<ChildLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/parent-connection-request" element={<ParentConnectionRequest />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        {/* Public cheatsheet routes - no authentication required */}
        <Route path="/cheatsheets" element={<Cheatsheets />} />
        <Route path="/cheatsheets/:cheatsheetId" element={<CheatsheetViewer />} />
        {/* Public game route - no authentication required */}
        <Route path="/wavelength" element={<WaveLength />} />
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="gymnasts" element={<Gymnasts />} />
          <Route path="levels" element={<Levels />} />
          <Route path="competitions" element={<Competitions />} />
          <Route path="progress/:gymnastId" element={<Progress />} />
          <Route path="my-progress" element={<MyProgress />} />
          <Route path="invites" element={<Invites />} />
          <Route path="users" element={<Users />} />
          <Route path="profile" element={<Profile />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="my-certificates" element={<MyCertificates />} />
          <Route path="certificates/:certificateId/preview" element={<CertificatePreview />} />
          <Route path="certificate-designer" element={<CertificateDesigner />} />
          <Route path="import" element={<ImportGymnasts />} />
          <Route path="club-settings" element={<ClubSettings />} />
          <Route path="branding" element={<Branding />} />
          <Route path="custom-fields" element={<CustomFields />} />
          <Route path="parent-requests" element={<ParentRequests />} />
          <Route path="health" element={<Health />} />
          <Route path="super-admin" element={<SuperAdmin />} />
        </Route>
        {/* Booking section — separate layout under /booking */}
        <Route path="/booking" element={
          <ProtectedRoute>
            <BookingLayout />
          </ProtectedRoute>
        }>
          <Route index element={<BookingCalendar />} />
          <Route path="session/:instanceId" element={<SessionDetail />} />
          <Route path="checkout/:bookingId" element={<Checkout />} />
          <Route path="cart" element={<Cart />} />
          <Route path="cart-confirmation" element={<CartConfirmation />} />
          <Route path="cart-checkout" element={<Navigate to="/booking/cart" replace />} />
          <Route path="confirmation/:bookingId" element={<BookingConfirmation />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="my-account" element={<MyChildren />} />
          <Route path="admin" element={<BookingAdmin />} />
          <Route path="admin/closures" element={<AdminClosures />} />
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
          <Route path="admin/shop-orders" element={<AdminShopOrders />} />
          <Route path="admin/recipient-groups" element={<AdminRecipientGroups />} />
          <Route path="admin/charges" element={<AdminCharges />} />
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