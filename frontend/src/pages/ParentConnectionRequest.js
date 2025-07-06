import React, { useState } from 'react';
import './ParentConnectionRequest.css';

const ParentConnectionRequest = () => {
  const [formData, setFormData] = useState({
    clubCode: '',
    requestedGymnastFirstName: '',
    requestedGymnastLastName: '',
    requestedGymnastDOB: '',
    requesterFirstName: '',
    requesterLastName: '',
    requesterEmail: '',
    requesterPhone: '',
    relationshipToGymnast: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const relationshipOptions = [
    'Mother',
    'Father',
    'Guardian',
    'Grandparent',
    'Other Family Member',
    'Other'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/guardian-requests/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setMessageType('success');
        // Reset form
        setFormData({
          clubCode: '',
          requestedGymnastFirstName: '',
          requestedGymnastLastName: '',
          requestedGymnastDOB: '',
          requesterFirstName: '',
          requesterLastName: '',
          requesterEmail: '',
          requesterPhone: '',
          relationshipToGymnast: ''
        });
      } else {
        setMessage(data.error || 'Failed to submit request');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Submit request error:', error);
      setMessage('Network error. Please try again.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="parent-connection-request">
      <div className="request-container">
        <div className="request-header">
          <h1>Connect to Your Child's Progress</h1>
          <p>
            Request access to view your child's gymnastics progress and achievements.
            A coach will review your request and connect you to your child's account.
          </p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="request-form">
          <div className="form-section">
            <h3>Club Information</h3>
            <div className="form-group">
              <label htmlFor="clubCode">
                Club Name or Email *
                <span className="help-text">Enter your child's club name or email address</span>
              </label>
              <input
                type="text"
                id="clubCode"
                name="clubCode"
                value={formData.clubCode}
                onChange={handleInputChange}
                required
                placeholder="e.g., Springboard Gymnastics or contact@clubname.com"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Your Child's Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="requestedGymnastFirstName">
                  Child's First Name *
                </label>
                <input
                  type="text"
                  id="requestedGymnastFirstName"
                  name="requestedGymnastFirstName"
                  value={formData.requestedGymnastFirstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="requestedGymnastLastName">
                  Child's Last Name *
                </label>
                <input
                  type="text"
                  id="requestedGymnastLastName"
                  name="requestedGymnastLastName"
                  value={formData.requestedGymnastLastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="requestedGymnastDOB">
                Child's Date of Birth
                <span className="help-text">Optional but helps confirm the correct gymnast</span>
              </label>
              <input
                type="date"
                id="requestedGymnastDOB"
                name="requestedGymnastDOB"
                value={formData.requestedGymnastDOB}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Your Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="requesterFirstName">
                  Your First Name *
                </label>
                <input
                  type="text"
                  id="requesterFirstName"
                  name="requesterFirstName"
                  value={formData.requesterFirstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="requesterLastName">
                  Your Last Name *
                </label>
                <input
                  type="text"
                  id="requesterLastName"
                  name="requesterLastName"
                  value={formData.requesterLastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="requesterEmail">
                  Your Email Address *
                </label>
                <input
                  type="email"
                  id="requesterEmail"
                  name="requesterEmail"
                  value={formData.requesterEmail}
                  onChange={handleInputChange}
                  required
                  placeholder="your.email@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="requesterPhone">
                  Your Phone Number
                </label>
                <input
                  type="tel"
                  id="requesterPhone"
                  name="requesterPhone"
                  value={formData.requesterPhone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="relationshipToGymnast">
                Relationship to Gymnast *
              </label>
              <select
                id="relationshipToGymnast"
                name="relationshipToGymnast"
                value={formData.relationshipToGymnast}
                onChange={handleInputChange}
                required
              >
                <option value="">Select relationship...</option>
                {relationshipOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-button"
            >
              {isSubmitting ? 'Submitting Request...' : 'Submit Connection Request'}
            </button>
          </div>
        </form>

        <div className="request-info">
          <h3>What happens next?</h3>
          <ol>
            <li>Your request will be sent to the coaches at the gymnastics club</li>
            <li>A coach will review your request and verify your child's information</li>
            <li>If approved, you'll receive login credentials to access your child's progress</li>
            <li>You'll be able to view achievements, certificates, and skill progress</li>
          </ol>
          
          <div className="help-section">
            <h4>Need help?</h4>
            <p>
              If you're having trouble with this form or need assistance, please contact 
              your child's gymnastics club directly. They can help you with the connection process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentConnectionRequest; 