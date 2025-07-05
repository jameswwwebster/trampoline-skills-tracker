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

  const handleDevLogin = async () => {
    setIsDevLoading(true);
    
    const result = await devLogin();
    
    if (result.success) {
      navigate('/', { replace: true });
    }
    
    setIsDevLoading(false);
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
              <small style={{ color: '#6c757d' }}>Development Mode</small>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDevLogin}
              disabled={isDevLoading}
              style={{ width: '100%' }}
            >
              {isDevLoading ? 'Logging in...' : 'Quick Login (Dev Coach)'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <small style={{ color: '#6c757d' }}>
                Email: dev@test.com | Password: password123
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login; 