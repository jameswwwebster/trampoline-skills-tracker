import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, updateUser, isAuthenticated } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await axios.get(`/api/invites/token/${token}`);
        setInvite(response.data.invite);
      } catch (error) {
        console.error('Failed to fetch invite:', error);
        setError(error.response?.data?.error || 'Invalid or expired invitation');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInvite();
    }
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!isAuthenticated) {
      // Store the token and redirect to login
      localStorage.setItem('pendingInviteToken', token);
      navigate(`/login?redirect=/invite/${token}`);
      return;
    }

    if (user.email !== invite.email) {
      setError('This invitation is for a different email address. Please log in with the correct account.');
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const response = await axios.post(`/api/invites/${invite.id}/accept`);
      
      // Update user context
      updateUser(response.data.user);
      
      // Redirect to dashboard
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to accept invite:', error);
      setError(error.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectInvite = async () => {
    if (!isAuthenticated) {
      setError('You must be logged in to reject an invitation');
      return;
    }

    if (user.email !== invite.email) {
      setError('This invitation is for a different email address');
      return;
    }

    if (!window.confirm('Are you sure you want to reject this invitation?')) {
      return;
    }

    try {
      await axios.post(`/api/invites/${invite.id}/reject`);
      setError('Invitation rejected');
    } catch (error) {
      console.error('Failed to reject invite:', error);
      setError(error.response?.data?.error || 'Failed to reject invitation');
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading">
            <div className="spinner"></div>
          </div>
          <p className="text-center">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2 className="auth-title">Invitation Error</h2>
          <div className="alert alert-error">
            {error}
          </div>
          <div className="auth-link">
            <Link to="/login">Login</Link> or <Link to="/register">Register</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2 className="auth-title">Invitation Not Found</h2>
          <p>The invitation you're looking for could not be found or has expired.</p>
          <div className="auth-link">
            <Link to="/login">Login</Link> or <Link to="/register">Register</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Club Invitation</h2>
        
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{invite.club.name}</h3>
          </div>
          <div>
            <p>
              <strong>{invite.invitedBy.firstName} {invite.invitedBy.lastName}</strong> has invited you to join <strong>{invite.club.name}</strong> as a <strong>{invite.role.toLowerCase()}</strong>.
            </p>
            
            {invite.club.address && (
              <p><strong>Address:</strong> {invite.club.address}</p>
            )}
            
            <p><strong>Invitation sent:</strong> {new Date(invite.createdAt).toLocaleDateString()}</p>
            <p><strong>Expires:</strong> {new Date(invite.expiresAt).toLocaleDateString()}</p>
          </div>
        </div>

        {!isAuthenticated ? (
          <div>
            <p>You need to login or register to accept this invitation.</p>
            <div className="flex">
              <Link to={`/login?redirect=/invite/${token}`} className="btn btn-primary">
                Login
              </Link>
              <Link to={`/register?email=${invite.email}&redirect=/invite/${token}`} className="btn btn-outline">
                Register
              </Link>
            </div>
          </div>
        ) : user.email !== invite.email ? (
          <div>
            <div className="alert alert-error">
              This invitation is for {invite.email}, but you're logged in as {user.email}.
            </div>
            <p>Please log in with the correct account or contact the club admin.</p>
          </div>
        ) : user.clubId ? (
          <div>
            <div className="alert alert-error">
              You are already a member of another club. You cannot accept this invitation.
            </div>
          </div>
        ) : (
          <div>
            <div className="flex">
              <button
                onClick={handleAcceptInvite}
                className="btn btn-success"
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <button
                onClick={handleRejectInvite}
                className="btn btn-danger"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite; 