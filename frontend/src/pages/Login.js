import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './booking/bookingVars.css';
import './AuthPages.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(null);
  const { login, devLogin, isAuthenticated, error } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/booking';
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

  const handleChange = (e) => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await login(formData.email, formData.password);
    if (result.success) navigate(next, { replace: true });
    setIsLoading(false);
  };

  const handleDevLogin = async (email) => {
    setIsDevLoading(true);
    setLoadingUser(email);
    const result = await devLogin(email);
    if (result.success) navigate(next, { replace: true });
    setIsDevLoading(false);
    setLoadingUser(null);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Trampoline Life</div>
        <h1 className="auth-heading">Sign in</h1>

        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">Email
            <input type="email" name="email" value={formData.email} onChange={handleChange}
              className="auth-input" required autoComplete="email" />
          </label>
          <label className="auth-label">Password
            <input type="password" name="password" value={formData.password} onChange={handleChange}
              className="auth-input" required autoComplete="current-password" />
          </label>
          <button type="submit" disabled={isLoading} className="auth-btn auth-btn--primary">
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          <span className="auth-links__sep">·</span>
          <Link to="/register" className="auth-link">Create an account</Link>
        </div>

        {isDevelopment && (
          <div className="auth-dev">
            <p className="auth-dev__label">Dev quick-login</p>
            {[
              { email: 'admin@test.com', label: 'Admin' },
              { email: 'dev@test.com', label: 'Coach' },
              { email: 'parent@test.com', label: 'Parent' },
            ].map(({ email, label }) => (
              <button key={email} type="button" className="auth-dev__btn"
                onClick={() => handleDevLogin(email)} disabled={isDevLoading}>
                {loadingUser === email ? '…' : label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
