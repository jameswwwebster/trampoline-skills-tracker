import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const ClubSettings = () => {
  const { user, isClubAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const fetchClubSettings = useCallback(async () => {
    try {
      const response = await axios.get(`/api/clubs/${user.clubId}`);
      setFormData({
        name: response.data.name || '',
        address: response.data.address || '',
        phone: response.data.phone || '',
        email: response.data.email || '',
        website: response.data.website || '',
        description: response.data.description || ''
      });
    } catch (error) {
      console.error('Failed to fetch club settings:', error);
      setError('Failed to load club settings');
    } finally {
      setLoading(false);
    }
  }, [user.clubId]);

  useEffect(() => {
    if (!isClubAdmin) {
      setError('Access denied. Only club administrators can access club settings.');
      setLoading(false);
      return;
    }

    fetchClubSettings();
  }, [isClubAdmin, fetchClubSettings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear success message when user makes changes
    if (success) setSuccess('');
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Club name is required';
    } else if (formData.name.length < 2) {
      errors.name = 'Club name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      errors.name = 'Club name must be less than 100 characters';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      errors.website = 'Please enter a valid website URL (must start with http:// or https://)';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
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

    setSaving(true);
    setError('');
    setSuccess('');
    setValidationErrors({});

    try {
      await axios.put(`/api/clubs/${user.clubId}`, formData);
      setSuccess('Club settings updated successfully!');
    } catch (error) {
      console.error('Failed to update club settings:', error);
      setError(error.response?.data?.error || 'Failed to update club settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading club settings...</p>
      </div>
    );
  }

  if (!isClubAdmin) {
    return (
      <div className="alert alert-error">
        Access denied. Only club administrators can access club settings.
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Club Settings</h1>
      </div>

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

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Basic Information</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Club Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control"
              placeholder="Enter your club name"
              required
            />
            {validationErrors.name && (
              <div className="text-danger">{validationErrors.name}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="address" className="form-label">
              Address
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="form-control"
              placeholder="Enter your club address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-control"
              placeholder="Enter your club phone number"
            />
          </div>

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
              placeholder="Enter your club email address"
            />
            {validationErrors.email && (
              <div className="text-danger">{validationErrors.email}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="website" className="form-label">
              Website
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="form-control"
              placeholder="https://your-club-website.com"
            />
            {validationErrors.website && (
              <div className="text-danger">{validationErrors.website}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control"
              placeholder="Tell us about your club..."
              rows="4"
            />
            <div className="text-muted small">
              {formData.description.length}/500 characters
            </div>
            {validationErrors.description && (
              <div className="text-danger">{validationErrors.description}</div>
            )}
          </div>


          <div className="flex-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClubSettings; 