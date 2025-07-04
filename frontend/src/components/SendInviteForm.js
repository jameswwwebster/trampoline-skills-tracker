import React, { useState } from 'react';
import axios from 'axios';

const SendInviteForm = ({ onInviteSent }) => {
  const [formData, setFormData] = useState({
    email: '',
    role: 'COACH'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);
    setError('');
    setValidationErrors({});

    try {
      const response = await axios.post('/api/invites', formData);
      
      // Reset form
      setFormData({
        email: '',
        role: 'COACH'
      });

      if (onInviteSent) {
        onInviteSent(response.data.invite);
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
      setError(error.response?.data?.error || 'Failed to send invite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Send Invitation</h3>
      </div>
      <div>
        <p>Invite coaches and parents to join your club by entering their email address.</p>
        
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-control"
              placeholder="coach@example.com"
              required
            />
            {validationErrors.email && (
              <div className="text-danger">{validationErrors.email}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="role" className="form-label">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="form-select"
              required
            >
              <option value="COACH">Coach</option>
              <option value="PARENT">Parent/Guardian</option>
            </select>
          </div>

          <div className="flex-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendInviteForm; 