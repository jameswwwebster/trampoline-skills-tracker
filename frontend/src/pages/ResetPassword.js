import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './booking/bookingVars.css';
import './AuthPages.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleChange = (e) => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/api/auth/reset-password', {
        token,
        password: formData.password,
      });
      if (response.data.success) {
        setMessage('Password set successfully. Taking you to sign in…');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(response.data.error || 'Failed to set password.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Trampoline Life</div>
        <h1 className="auth-heading">Set new password</h1>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        {token && !message && (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label">New password
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="auth-input"
                required
                minLength="6"
                autoComplete="new-password"
              />
            </label>
            <label className="auth-label">Confirm new password
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="auth-input"
                required
                minLength="6"
                autoComplete="new-password"
              />
            </label>
            <button type="submit" disabled={isLoading} className="auth-btn auth-btn--primary">
              {isLoading ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link to="/login" className="auth-link">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
