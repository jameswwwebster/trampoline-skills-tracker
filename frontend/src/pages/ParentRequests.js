import React, { useState, useEffect } from 'react';
// import { useAuth } from '../contexts/AuthContext'; // Not used currently
import './ParentRequests.css';

const ParentRequests = () => {
  // const { user } = useAuth(); // Not used currently
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('PENDING');

  useEffect(() => {
    fetchRequests();
  }, [selectedStatus]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/guardian-requests?status=${selectedStatus}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // Ensure we always set an array
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setRequests([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchPotentialMatches = async (requestId) => {
    setLoadingMatches(true);
    try {
      const response = await fetch(`/api/guardian-requests/${requestId}/matches`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setPotentialMatches(data.potentialMatches || []);
      setSelectedRequest(data.request);
    } catch (error) {
      console.error('Error fetching potential matches:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const processRequest = async (requestId, action, selectedGymnastId = null, createNewParent = false, notes = '') => {
    setProcessingRequest(true);
    try {
      const response = await fetch(`/api/guardian-requests/${requestId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          action,
          selectedGymnastId,
          createNewParent,
          notes
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        setSelectedRequest(null);
        setPotentialMatches([]);
        fetchRequests(); // Refresh the list
      } else {
        alert(data.error || 'Failed to process request');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Network error. Please try again.');
    } finally {
      setProcessingRequest(false);
    }
  };

  const disconnectParent = async (gymnastId, guardianId) => {
    if (!window.confirm('Are you sure you want to disconnect this parent from the gymnast?')) {
      return;
    }

    try {
      const response = await fetch(`/api/guardian-requests/connections/${gymnastId}/guardians/${guardianId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        fetchRequests(); // Refresh the list
      } else {
        alert(data.error || 'Failed to disconnect parent');
      }
    } catch (error) {
      console.error('Error disconnecting parent:', error);
      alert('Network error. Please try again.');
    }
  };

  const getMatchTypeColor = (matchType) => {
    switch (matchType) {
      case 'exact': return '#27ae60';
      case 'date-confirmed': return '#3498db';
      case 'fuzzy': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  const getMatchTypeText = (matchType) => {
    switch (matchType) {
      case 'exact': return 'Exact Match';
      case 'date-confirmed': return 'Date Confirmed';
      case 'fuzzy': return 'Possible Match';
      default: return 'Weak Match';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="parent-requests">
        <div className="loading">Loading parent requests...</div>
      </div>
    );
  }

  return (
    <div className="parent-requests">
      <div className="requests-header">
        <h2>Parent Connection Requests</h2>
        <div className="status-filter">
          <label htmlFor="status-select">Filter by status:</label>
          <select 
            id="status-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="no-requests">
          <p>No {selectedStatus.toLowerCase()} requests found.</p>
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map(request => (
            <div key={request.id} className={`request-card ${request.status.toLowerCase()}`}>
              <div className="request-header">
                <h3>{request.requesterFirstName} {request.requesterLastName}</h3>
                <span className={`status-badge ${request.status.toLowerCase()}`}>
                  {request.status}
                </span>
              </div>
              
              <div className="request-details">
                <div className="detail-row">
                  <span className="label">Relationship:</span>
                  <span className="value">{request.relationshipToGymnast}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Email:</span>
                  <span className="value">{request.requesterEmail}</span>
                </div>
                {request.requesterPhone && (
                  <div className="detail-row">
                    <span className="label">Phone:</span>
                    <span className="value">{request.requesterPhone}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="label">Requested At:</span>
                  <span className="value">{formatDate(request.createdAt)}</span>
                </div>
              </div>

              <div className="gymnast-info">
                <h4>Requested Gymnast:</h4>
                <p><strong>{request.requestedGymnastFirstName} {request.requestedGymnastLastName}</strong></p>
                <p>DOB: {formatDate(request.requestedGymnastDOB)}</p>
              </div>

              {request.status === 'PENDING' && (
                <div className="request-actions">
                  <button 
                    onClick={() => fetchPotentialMatches(request.id)}
                    className="btn btn-primary"
                    disabled={loadingMatches}
                  >
                    {loadingMatches ? 'Loading...' : 'View Matches'}
                  </button>
                  <button 
                    onClick={() => processRequest(request.id, 'reject')}
                    className="btn btn-danger"
                    disabled={processingRequest}
                  >
                    Reject
                  </button>
                </div>
              )}

              {request.status === 'APPROVED' && request.gymnast && (
                <div className="connection-info">
                  <h4>Connected To:</h4>
                  <p><strong>{request.gymnast.firstName} {request.gymnast.lastName}</strong></p>
                  <p>DOB: {formatDate(request.gymnast.dateOfBirth)}</p>
                  {request.guardian && (
                    <button 
                      onClick={() => disconnectParent(request.gymnast.id, request.guardian.id)}
                      className="btn btn-warning btn-sm"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              )}

              {request.status === 'REJECTED' && request.processedBy && (
                <div className="processed-info">
                  <p><strong>Rejected by:</strong> {request.processedBy.firstName} {request.processedBy.lastName}</p>
                  {request.notes && <p><strong>Notes:</strong> {request.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Potential Matches Modal */}
      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Potential Matches</h3>
              <button 
                onClick={() => {
                  setSelectedRequest(null);
                  setPotentialMatches([]);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="request-summary">
                <h4>Request Details:</h4>
                <p><strong>Parent:</strong> {selectedRequest.requesterFirstName} {selectedRequest.requesterLastName}</p>
                <p><strong>Email:</strong> {selectedRequest.requesterEmail}</p>
                <p><strong>Looking for:</strong> {selectedRequest.requestedGymnastFirstName} {selectedRequest.requestedGymnastLastName}</p>
                <p><strong>DOB:</strong> {formatDate(selectedRequest.requestedGymnastDOB)}</p>
                <p><strong>Relationship:</strong> {selectedRequest.relationshipToGymnast}</p>
              </div>

              <div className="matches-section">
                <h4>Potential Matches ({potentialMatches.length}):</h4>
                {potentialMatches.length === 0 ? (
                  <p>No potential matches found.</p>
                ) : (
                  <div className="matches-list">
                    {potentialMatches.map(match => (
                      <div key={match.id} className="match-card">
                        <div className="match-header">
                          <h5>{match.firstName} {match.lastName}</h5>
                          <span 
                            className="match-type"
                            style={{ backgroundColor: getMatchTypeColor(match.matchType) }}
                          >
                            {getMatchTypeText(match.matchType)}
                          </span>
                          <span className="match-score">Score: {match.matchScore}</span>
                        </div>
                        <div className="match-details">
                          <p><strong>DOB:</strong> {formatDate(match.dateOfBirth)}</p>
                          <p><strong>Current Guardians:</strong> {match.guardians.length}</p>
                          {match.guardians.map(guardian => (
                            <div key={guardian.id} className="guardian-info">
                              • {guardian.firstName} {guardian.lastName} ({guardian.email})
                            </div>
                          ))}
                        </div>
                        <div className="match-actions">
                          <button 
                            onClick={() => {
                              const createNew = !selectedRequest.requesterEmail || 
                                window.confirm('Create a new parent account? Click OK to create new, Cancel to use existing.');
                              processRequest(selectedRequest.id, 'approve', match.id, createNew);
                            }}
                            className="btn btn-success"
                            disabled={processingRequest}
                          >
                            {processingRequest ? 'Processing...' : 'Approve This Match'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentRequests; 