// frontend/src/pages/booking/admin/AdminRegister.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATUS_CYCLE = { UNMARKED: 'PRESENT', PRESENT: 'ABSENT', ABSENT: 'ABSENT' };

const STATUS_STYLE = {
  PRESENT:  { background: '#d4edda', color: '#155724', border: '2px solid #28a745' },
  ABSENT:   { background: '#f8d7da', color: '#721c24', border: '2px solid #dc3545' },
  UNMARKED: { background: 'var(--booking-bg-light)', color: 'var(--booking-text-muted)', border: '2px solid var(--booking-border)' },
};

const STATUS_LABEL = { PRESENT: 'Present', ABSENT: 'Absent', UNMARKED: 'Unmarked' };

function formatDate(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function AdminRegister() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getAttendance(instanceId)
      .then(res => {
        setSession(res.data.session);
        setAttendees(res.data.attendees);
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setError('Session not found.');
        } else {
          setError('Failed to load register.');
        }
      })
      .finally(() => setLoading(false));
  }, [instanceId]);

  const handleTap = useCallback(async (gymnast) => {
    const next = STATUS_CYCLE[gymnast.status];
    if (next === gymnast.status) return;
    setAttendees(prev => prev.map(a => a.gymnastId === gymnast.gymnastId ? { ...a, status: next } : a));
    setSaving(prev => ({ ...prev, [gymnast.gymnastId]: true }));
    try {
      await bookingApi.createAttendance(instanceId, { gymnastId: gymnast.gymnastId, status: next });
    } catch {
      setAttendees(prev => prev.map(a => a.gymnastId === gymnast.gymnastId ? { ...a, status: gymnast.status } : a));
    } finally {
      setSaving(prev => ({ ...prev, [gymnast.gymnastId]: false }));
    }
  }, [instanceId]);

  const presentCount = attendees.filter(a => a.status === 'PRESENT').length;
  const absentCount = attendees.filter(a => a.status === 'ABSENT').length;
  const unmarkedCount = attendees.filter(a => a.status === 'UNMARKED').length;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--booking-text-muted)' }}>
        Loading register...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p className="bk-error">{error}</p>
        <button className="bk-btn" onClick={() => navigate('/booking/admin')}>Back to sessions</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', fontSize: '1.4rem',
            cursor: 'pointer', color: 'var(--booking-text-muted)', padding: '0.25rem',
          }}
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
            {session?.startTime}–{session?.endTime}
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
            {formatDate(session?.date)}
          </p>
        </div>
      </div>

      {/* Summary counts */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
        <span style={{ color: '#155724' }}>{presentCount} present</span>
        <span style={{ color: '#721c24' }}>{absentCount} absent</span>
        <span style={{ color: 'var(--booking-text-muted)' }}>{unmarkedCount} unmarked</span>
      </div>

      {/* Attendee list */}
      {attendees.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No one is expected at this session.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {attendees.map(a => (
            <li
              key={a.gymnastId}
              onClick={() => !saving[a.gymnastId] && handleTap(a)}
              style={{
                ...STATUS_STYLE[a.status],
                borderRadius: 'var(--booking-radius)',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: saving[a.gymnastId] ? 'wait' : 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                opacity: saving[a.gymnastId] ? 0.7 : 1,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                {a.firstName} {a.lastName}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                {saving[a.gymnastId] ? '...' : STATUS_LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
