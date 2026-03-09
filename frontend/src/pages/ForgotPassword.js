import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './booking/bookingVars.css';
import './AuthPages.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      if (response.data.success) {
        setMessage("Check your inbox \u2014 we've sent a link to reset your password.");
      } else {
        setError(response.data.error || 'Failed to send reset email.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Trampoline Life</div>
        <h1 className="auth-heading">Reset password</h1>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        {!message && (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label">Email address
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="auth-input"
                required
                autoComplete="email"
              />
            </label>
            <button type="submit" disabled={isLoading} className="auth-btn auth-btn--primary">
              {isLoading ? 'Sending…' : 'Send reset link'}
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

export default ForgotPassword;
