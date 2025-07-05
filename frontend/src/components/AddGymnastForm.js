import React, { useState } from 'react';
import axios from 'axios';

const AddGymnastForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    guardianEmails: []
  });
  const [guardianEmail, setGuardianEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addGuardianEmail = () => {
    if (!guardianEmail.trim()) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guardianEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (formData.guardianEmails.includes(guardianEmail)) {
      setError('This guardian email is already added');
      return;
    }

    setFormData(prev => ({
      ...prev,
      guardianEmails: [...prev.guardianEmails, guardianEmail]
    }));
    setGuardianEmail('');
    setError('');
  };

  const removeGuardianEmail = (emailToRemove) => {
    setFormData(prev => ({
      ...prev,
      guardianEmails: prev.guardianEmails.filter(email => email !== emailToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/gymnasts', formData);
      setSuccess('Gymnast added successfully!');
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        guardianEmails: []
      });
      
      // Call success callback
      if (onSuccess) {
        onSuccess(response.data);
      }
      
    } catch (error) {
      console.error('Add gymnast error:', error);
      setError(error.response?.data?.error || 'Failed to add gymnast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Add New Gymnast</h3>
      </div>
      
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="form-control"
              placeholder="Enter first name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="form-control"
              placeholder="Enter last name"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="dateOfBirth">Date of Birth</label>
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label htmlFor="guardianEmail">Guardian Emails</label>
          <div className="guardian-email-input">
            <input
              type="email"
              id="guardianEmail"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="form-control"
              placeholder="Enter guardian email"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGuardianEmail())}
            />
            <button 
              type="button" 
              onClick={addGuardianEmail}
              className="btn btn-outline"
              disabled={!guardianEmail.trim()}
            >
              Add
            </button>
          </div>
          <small className="form-text">
            Add email addresses of parents/guardians who should have access to this gymnast's progress.
            The guardian accounts must already exist in the system.
          </small>
        </div>

        {formData.guardianEmails.length > 0 && (
          <div className="form-group">
            <label>Added Guardians:</label>
            <div className="guardian-tags">
              {formData.guardianEmails.map(email => (
                <span key={email} className="tag">
                  {email}
                  <button 
                    type="button" 
                    onClick={() => removeGuardianEmail(email)}
                    className="tag-remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Adding...' : 'Add Gymnast'}
          </button>
          <button 
            type="button" 
            onClick={onCancel}
            className="btn btn-outline"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddGymnastForm; 