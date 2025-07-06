import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
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
import ImportGymnasts from './pages/ImportGymnasts';
import AcceptInvite from './pages/AcceptInvite';
import ClubSettings from './pages/ClubSettings';
import Branding from './pages/Branding';
import './App.css';

function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/child-login" element={<ChildLogin />} />
            <Route path="/register" element={<Register />} />
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
              <Route path="certificate-designer" element={<CertificateDesigner />} />
              <Route path="import" element={<ImportGymnasts />} />
              <Route path="club-settings" element={<ClubSettings />} />
              <Route path="branding" element={<Branding />} />
            </Route>
          </Routes>
        </div>
      </AuthProvider>
    </BrandingProvider>
  );
}

export default App; 