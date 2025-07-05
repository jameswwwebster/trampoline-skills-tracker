import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import AcceptInvite from './pages/AcceptInvite';
import './App.css';

function App() {
  return (
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
          </Route>
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App; 