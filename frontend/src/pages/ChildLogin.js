import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ChildLogin = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    accessCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gymnasts, setGymnasts] = useState([]);
  const [needsDisambiguation, setNeedsDisambiguation] = useState(false);
  const navigate = useNavigate();
  const { childLogin, childLoginDisambiguate } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsDisambiguation(false);

    try {
      const result = await childLogin(formData.firstName, formData.lastName, formData.accessCode);
      if (result.success) {
        navigate('/my-progress');
      } else if (result.needsDisambiguation) {
        setNeedsDisambiguation(true);
        setGymnasts(result.gymnasts);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGymnastSelect = async (gymnastId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await childLoginDisambiguate(gymnastId, formData.accessCode);
      if (result.success) {
        navigate('/my-progress');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  if (needsDisambiguation) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>👧👦 Select Your Profile</h2>
            <p>We found multiple gymnasts with the name "{formData.firstName} {formData.lastName}". Please select your profile:</p>
          </div>

          <div className="gymnast-selection">
            {gymnasts.map((gymnast) => (
              <div key={gymnast.id} className="gymnast-option">
                <button
                  onClick={() => handleGymnastSelect(gymnast.id)}
                  className="btn btn-outline btn-full"
                  disabled={loading}
                >
                  <div className="gymnast-info">
                    <h3>{gymnast.firstName} {gymnast.lastName}</h3>
                    <p>Date of Birth: {formatDate(gymnast.dateOfBirth)}</p>
                    <p>Club: {gymnast.club?.name}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="auth-footer">
            <button 
              onClick={() => {
                setNeedsDisambiguation(false);
                setGymnasts([]);
                setError(null);
              }}
              className="btn btn-secondary"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>👧👦 Kids Login</h2>
          <p>Enter your name and access code to see your progress!</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              placeholder="Your first name"
              autoComplete="given-name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              placeholder="Your last name"
              autoComplete="family-name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="accessCode">Access Code</label>
            <input
              type="text"
              id="accessCode"
              name="accessCode"
              value={formData.accessCode}
              onChange={handleChange}
              required
              placeholder="6-digit access code"
              maxLength={6}
              pattern="[0-9]{6}"
              title="Access code should be 6 digits"
            />
            <small className="form-help">
              💡 Ask your parent, guardian, or coach for the 6-digit access code
            </small>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Logging in...' : '🚀 See My Progress'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            <Link to="/login">👨‍👩‍👧‍👦 Parent/Guardian/Coach Login</Link>
          </p>
          <p>
            <small>Don't have an access code? Ask your parent, guardian, or coach to generate one!</small>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChildLogin; 