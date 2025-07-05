import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const EditGymnastForm = ({ gymnast, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    firstName: gymnast?.firstName || '',
    lastName: gymnast?.lastName || '',
    dateOfBirth: gymnast?.dateOfBirth ? new Date(gymnast.dateOfBirth).toISOString().split('T')[0] : ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  // Only coaches and club admins can edit gymnasts
  const canEdit = user?.role === 'COACH' || user?.role === 'CLUB_ADMIN';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear success message when user makes changes
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canEdit) {
      setError('You do not have permission to edit gymnasts');
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.put(`/api/gymnasts/${gymnast.id}`, formData);
      setSuccess('Gymnast updated successfully!');
      
      // Call success callback immediately to refresh data
      if (onSuccess) {
        onSuccess(response.data);
      }
      
    } catch (error) {
      console.error('Update gymnast error:', error);
      setError(error.response?.data?.error || 'Failed to update gymnast');
    } finally {
      setLoading(false);
    }
  };

  if (!gymnast) {
    return (
      <div className="alert alert-error">
        No gymnast data provided for editing.
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="alert alert-error">
        You do not have permission to edit gymnasts.
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Edit Gymnast</h3>
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
              disabled={loading}
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
              disabled={loading}
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
            disabled={loading}
          />
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Updating...' : 'Update Gymnast'}
          </button>
          <button 
            type="button" 
            onClick={onCancel}
            className="btn btn-outline"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditGymnastForm; 