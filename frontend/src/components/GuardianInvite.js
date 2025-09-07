import React, { useState, useEffect } from 'react';
import axios from 'axios';

const GuardianInvite = () => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [formData, setFormData] = useState({
    guardianEmail: '',
    guardianFirstName: '',
    guardianLastName: '',
    relationship: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/guardian-invites/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch guardian status:', error);
      setError('Failed to load guardian status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/guardian-invites/invite', formData);
      setSuccess(response.data.message);
      setFormData({
        guardianEmail: '',
        guardianFirstName: '',
        guardianLastName: '',
        relationship: ''
      });
      // Refresh status to update guardian list
      await fetchStatus();
    } catch (error) {
      console.error('Failed to send guardian invitation:', error);
      setError(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Guardian Invitation</h3>
        </div>
        <div className="card-body">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!status.isUnder18) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Guardian Invitation</h3>
        </div>
        <div className="card-body">
          <p>Guardian invitations are only available for users under 18 years old.</p>
        </div>
      </div>
    );
  }

  if (status.hasGuardians) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Your Guardians</h3>
        </div>
        <div className="card-body">
          <p>You already have guardians assigned:</p>
          <ul>
            {status.guardians.map((guardian, index) => (
              <li key={index}>
                {guardian.firstName} {guardian.lastName} ({guardian.email})
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Invite a Guardian</h3>
      </div>
      <div className="card-body">
        <p>Since you're under 18, you can invite a parent or guardian to connect with your account.</p>
        
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="guardianFirstName" className="form-label">
              Guardian's First Name *
            </label>
            <input
              type="text"
              id="guardianFirstName"
              name="guardianFirstName"
              value={formData.guardianFirstName}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="guardianLastName" className="form-label">
              Guardian's Last Name *
            </label>
            <input
              type="text"
              id="guardianLastName"
              name="guardianLastName"
              value={formData.guardianLastName}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="guardianEmail" className="form-label">
              Guardian's Email Address *
            </label>
            <input
              type="email"
              id="guardianEmail"
              name="guardianEmail"
              value={formData.guardianEmail}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="relationship" className="form-label">
              Relationship to You *
            </label>
            <select
              id="relationship"
              name="relationship"
              value={formData.relationship}
              onChange={handleChange}
              className="form-control"
              required
            >
              <option value="">Select relationship</option>
              <option value="Mother">Mother</option>
              <option value="Father">Father</option>
              <option value="Step-Mother">Step-Mother</option>
              <option value="Step-Father">Step-Father</option>
              <option value="Grandmother">Grandmother</option>
              <option value="Grandfather">Grandfather</option>
              <option value="Aunt">Aunt</option>
              <option value="Uncle">Uncle</option>
              <option value="Legal Guardian">Legal Guardian</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isInviting}
            style={{ width: '100%' }}
          >
            {isInviting ? 'Sending Invitation...' : 'Send Guardian Invitation'}
          </button>
        </form>

        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6c757d' }}>
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>An invitation email will be sent to your guardian</li>
            <li>They can accept the invitation to connect with your account</li>
            <li>Once connected, they can view your progress and receive notifications</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GuardianInvite;
