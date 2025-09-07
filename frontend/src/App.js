import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import './App.css';

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
      <RateLimitBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/child-login" element={<ChildLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/parent-connection-request" element={<ParentConnectionRequest />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
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