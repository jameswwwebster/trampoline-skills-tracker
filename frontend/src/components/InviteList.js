import React, { useState, useEffect } from 'react';
import axios from 'axios';

const InviteList = ({ refreshTrigger }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/invites');
      setInvites(response.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
      setError('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [refreshTrigger]);

  const handleCancelInvite = async (inviteId) => {
    if (!window.confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      await axios.delete(`/api/invites/${inviteId}`);
      // Refresh the list
      fetchInvites();
    } catch (error) {
      console.error('Failed to cancel invite:', error);
      alert('Failed to cancel invitation');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': 'badge-warning',
      'ACCEPTED': 'badge-success',
      'REJECTED': 'badge-danger',
      'EXPIRED': 'badge-secondary'
    };
    return badges[status] || 'badge-secondary';
  };

  const getInviteLink = (invite) => {
    return `${window.location.origin}/invite/${invite.token}`;
  };

  const copyInviteLink = (invite) => {
    const link = getInviteLink(invite);
    navigator.clipboard.writeText(link).then(() => {
      alert('Invite link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link. Please copy manually: ' + link);
    });
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Sent Invitations</h3>
      </div>
      <div>
        {invites.length === 0 ? (
          <p>No invitations have been sent yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(invite => (
                <tr key={invite.id}>
                  <td>
                    <strong>{invite.email}</strong>
                  </td>
                  <td>
                    {invite.role.replace('_', ' ')}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(invite.status)}`}>
                      {invite.status}
                    </span>
                  </td>
                  <td>
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex">
                      {invite.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => copyInviteLink(invite)}
                            className="btn btn-sm btn-outline"
                            title="Copy invite link"
                          >
                            Copy Link
                          </button>
                          <button
                            onClick={() => handleCancelInvite(invite.id)}
                            className="btn btn-sm btn-danger"
                            title="Cancel invitation"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {invite.status === 'ACCEPTED' && invite.acceptedBy && (
                        <span className="text-muted">
                          Accepted by {invite.acceptedBy.firstName} {invite.acceptedBy.lastName}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InviteList; 