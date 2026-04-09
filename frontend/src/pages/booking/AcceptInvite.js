import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInviteByToken, acceptGuardianInvite } from '../../utils/bookingApi';
import { useAuth } from '../../contexts/AuthContext';
import './booking-shared.css';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    getInviteByToken(token)
      .then(res => setInvite(res.data))
      .catch(() => setError('This invitation link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await acceptGuardianInvite(token);
      setAccepted(true);
      setTimeout(() => navigate('/booking/my-account'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept invitation. Please try again.');
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="bk-page bk-page--sm" style={{ paddingTop: '3rem', textAlign: 'center' }}>
        <p className="bk-muted">Loading…</p>
      </div>
    );
  }

  const isExpired = invite && invite.expiresAt && new Date(invite.expiresAt) < new Date();
  const isAlreadyAccepted = invite && invite.acceptedAt;

  return (
    <div className="bk-page bk-page--sm" style={{ paddingTop: '3rem' }}>
      <div className="bk-card" style={{ maxWidth: '460px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 0.5rem' }}>Guardian invitation</h2>

        {error && !invite && (
          <p className="bk-error">{error}</p>
        )}

        {invite && (
          <>
            {isAlreadyAccepted ? (
              <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.925rem' }}>
                This invitation has already been accepted.
              </p>
            ) : isExpired ? (
              <p style={{ color: 'var(--booking-danger)', fontSize: '0.925rem' }}>
                This invitation expired on {new Date(invite.expiresAt).toLocaleDateString('en-GB')}. Please ask {invite.invitedBy.firstName} to send a new one.
              </p>
            ) : accepted ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--booking-accent)' }}>
                  You're now a co-guardian for {invite.gymnast.firstName} {invite.gymnast.lastName}!
                </p>
                <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.9rem' }}>Redirecting to your account…</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.925rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  <strong>{invite.invitedBy.firstName} {invite.invitedBy.lastName}</strong> has invited you to become a co-guardian for{' '}
                  <strong>{invite.gymnast.firstName} {invite.gymnast.lastName}</strong>.
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  As a co-guardian you'll have the same access — session bookings, progress tracking, health notes, and more.
                </p>

                {user ? (
                  <>
                    <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                      You're logged in as <strong>{user.firstName} {user.lastName}</strong>. Click below to accept.
                    </p>
                    {error && <p className="bk-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
                    <button
                      className="bk-btn bk-btn--primary"
                      style={{ width: '100%' }}
                      disabled={accepting}
                      onClick={handleAccept}
                    >
                      {accepting ? 'Accepting…' : 'Accept invitation'}
                    </button>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', textAlign: 'center', color: 'var(--booking-text-muted)' }}>
                      Not {user.firstName}?{' '}
                      <Link to={`/login?returnTo=/booking/accept-invite/${token}`} style={{ color: 'var(--booking-accent)' }}>
                        Log in with a different account
                      </Link>
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem', color: 'var(--booking-text-muted)' }}>
                      You need to be logged in to accept this invitation.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <Link
                        to={`/login?returnTo=/booking/accept-invite/${token}`}
                        className="bk-btn bk-btn--primary"
                        style={{ textAlign: 'center' }}
                      >
                        Log in to accept
                      </Link>
                      <Link
                        to={`/register?returnTo=/booking/accept-invite/${token}`}
                        className="bk-btn"
                        style={{ textAlign: 'center', border: '1px solid var(--booking-border)' }}
                      >
                        Create a new account
                      </Link>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
