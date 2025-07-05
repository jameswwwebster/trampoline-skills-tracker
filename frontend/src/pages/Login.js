import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(null);
  const { login, devLogin, isAuthenticated, error } = useAuth();
  const navigate = useNavigate();

  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      navigate('/', { replace: true });
    }
    
    setIsLoading(false);
  };

  const handleDevLogin = async (email = null) => {
    console.log('handleDevLogin called with email:', email);
    setIsDevLoading(true);
    setLoadingUser(email);
    
    const result = await devLogin(email);
    
    if (result.success) {
      navigate('/', { replace: true });
    }
    
    setIsDevLoading(false);
    setLoadingUser(null);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Login to Trampoline Tracker</h2>
        
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>

        {isDevelopment && (
          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #dee2e6' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <small style={{ color: '#6c757d' }}>Development Mode - Quick Login</small>
            </div>
            
            {/* Test User Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleDevLogin('admin@test.com')}
                disabled={isDevLoading}
                style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
              >
                {loadingUser === 'admin@test.com' ? (
                  <span>🔄 Logging in...</span>
                ) : (
                  <>
                    <strong>👑 Admin</strong>
                    <br />
                    <small style={{ color: '#6c757d' }}>Club Admin - Full Access</small>
                  </>
                )}
              </button>
              
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleDevLogin('dev@test.com')}
                disabled={isDevLoading}
                style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
              >
                {loadingUser === 'dev@test.com' ? (
                  <span>🔄 Logging in...</span>
                ) : (
                  <>
                    <strong>🏃‍♂️ Coach</strong>
                    <br />
                    <small style={{ color: '#6c757d' }}>John Smith - Can manage gymnasts</small>
                  </>
                )}
              </button>
              
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleDevLogin('coach2@test.com')}
                disabled={isDevLoading}
                style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
              >
                {loadingUser === 'coach2@test.com' ? (
                  <span>🔄 Logging in...</span>
                ) : (
                  <>
                    <strong>🏃‍♀️ Coach 2</strong>
                    <br />
                    <small style={{ color: '#6c757d' }}>Mike Wilson - Can manage gymnasts</small>
                  </>
                )}
              </button>
              
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleDevLogin('gymnast@test.com')}
                disabled={isDevLoading}
                style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
              >
                {loadingUser === 'gymnast@test.com' ? (
                  <span>🔄 Logging in...</span>
                ) : (
                  <>
                    <strong>🤸‍♀️ Gymnast</strong>
                    <br />
                    <small style={{ color: '#6c757d' }}>Emma Smith - Can view own progress</small>
                  </>
                )}
              </button>
              
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleDevLogin('parent@test.com')}
                disabled={isDevLoading}
                style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
              >
                {loadingUser === 'parent@test.com' ? (
                  <span>🔄 Logging in...</span>
                ) : (
                  <>
                    <strong>👨‍👩‍👧‍👦 Parent</strong>
                    <br />
                    <small style={{ color: '#6c757d' }}>Sarah Johnson - Can view children's progress</small>
                  </>
                )}
              </button>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <small style={{ color: '#6c757d' }}>
                All test accounts use password: password123
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login; 