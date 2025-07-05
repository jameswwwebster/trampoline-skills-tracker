import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const ChildLogin = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    familyAccessCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { childLogin } = useAuth();

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

    try {
      const result = await childLogin(formData.firstName, formData.lastName, formData.familyAccessCode);
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

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>👧👦 Kids Login</h2>
          <p>Enter your name and family code to see your progress!</p>
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
            <label htmlFor="familyAccessCode">Family Code</label>
            <input
              type="text"
              id="familyAccessCode"
              name="familyAccessCode"
              value={formData.familyAccessCode}
              onChange={handleChange}
              required
              placeholder="Ask your parent for the family code"
              maxLength={6}
              pattern="[0-9]{6}"
              title="Family code should be 6 digits"
            />
            <small className="form-help">
              💡 Ask your parent or guardian for the 6-digit family code
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
            <Link to="/login">👨‍👩‍👧‍👦 Parent/Guardian Login</Link>
          </p>
          <p>
            <small>Don't have a family code? Ask your parent to generate one!</small>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChildLogin; 