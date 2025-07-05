import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configure axios defaults
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await axios.get('/api/auth/me');
          setUser(response.data);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/login', { email, password });
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/register', userData);
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const devLogin = async (email = null) => {
    try {
      setError(null);
      console.log('DevLogin called with email:', email);
      const response = await axios.post('/api/auth/dev-login', { email });
      console.log('DevLogin response:', response.data);
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Development login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const childLogin = async (firstName, lastName, familyAccessCode) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/child-login', { 
        firstName, 
        lastName, 
        familyAccessCode 
      });
      const { child, token } = response.data;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Create a child user object that looks like a regular user
      const childUser = {
        ...child,
        role: 'CHILD',
        isChild: true
      };
      
      setUser(childUser);
      
      return { success: true, user: childUser };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Child login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const generateFamilyCode = async () => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/generate-family-code');
      const { user: updatedUser, familyAccessCode } = response.data;
      
      setUser(updatedUser);
      
      return { success: true, familyAccessCode };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to generate family code';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const value = {
    user,
    login,
    register,
    logout,
    devLogin,
    childLogin,
    generateFamilyCode,
    updateUser,
    loading,
    error,
    isAuthenticated: !!user,
    isClubAdmin: user?.role === 'CLUB_ADMIN',
    isCoach: user?.role === 'COACH',
    isGymnast: user?.role === 'GYMNAST',
    isParent: user?.role === 'PARENT',
    isChild: user?.role === 'CHILD',
    canManageClub: user?.role === 'CLUB_ADMIN',
    canManageGymnasts: user?.role === 'CLUB_ADMIN' || user?.role === 'COACH',
    canMarkProgress: user?.role === 'CLUB_ADMIN' || user?.role === 'COACH',
    canEditCompetitions: user?.role === 'CLUB_ADMIN',
    canEditLevels: user?.role === 'CLUB_ADMIN',
    canReadCompetitions: user?.role === 'CLUB_ADMIN' || user?.role === 'COACH',
    canReadLevels: true, // All authenticated users can read levels
    canViewProgress: true, // All authenticated users can view progress (with backend access controls)
    canViewOwnProgress: user?.role === 'PARENT' || user?.role === 'CHILD', // Parents and children can view progress
    needsProgressNavigation: user?.role === 'PARENT' || user?.role === 'CHILD', // Parents and children need progress navigation
    needsFamilyCodeManagement: user?.role === 'PARENT' // Only parents need family code management
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 