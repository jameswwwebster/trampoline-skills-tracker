import React, { useState } from 'react';
import { bookingApi } from '../utils/bookingApi';

const STANDARD_PRESETS = [
  { label: 'All members', filter: { type: 'all' } },
  { label: 'Parents only', filter: { type: 'role', role: 'PARENT' } },
  { label: 'Coaches only', filter: { type: 'role', role: 'COACH' } },
  { label: 'Active membership', filter: { type: 'active_membership' } },
  { label: 'Expiring credits', filter: { type: 'expiring_credits' } },
  { label: 'No upcoming bookings', filter: { type: 'no_upcoming_bookings' } },
];

export default function RecipientPicker({ value, onChange, groups = [], forceEnabled = false }) {
  const enabled = forceEnabled || (value !== null && value !== undefined);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [mode, setMode] = useState('preset');
  const [adhocSearch, setAdhocSearch] = useState('');
  const [adhocUsers, setAdhocUsers] = useState([]);
  const [adhocSelected, setAdhocSelected] = useState(
    value?.type === 'adhoc' ? (value.userIds || []) : []
  );

  React.useEffect(() => {
    if (mode === 'adhoc' && adhocUsers.length === 0) {
      const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      fetch(`${API_URL}/users`, { headers })
        .then(r => r.json())
        .then(data => setAdhocUsers(Array.isArray(data) ? data : data.users || []))
        .catch(() => {});
    }
  }, [mode]);

  const handleToggle = () => {
    if (enabled) {
      onChange(null);
      setPreview(null);
    } else {
      onChange(STANDARD_PRESETS[0].filter);
      setPreview(null);
    }
  };

  const handlePresetChange = (filter) => {
    onChange(filter);
    setPreview(null);
  };

  const handleGroupChange = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      onChange(group.recipientFilter);
      setPreview(null);
    }
  };

  const handleAdhocToggle = (userId) => {
    const next = adhocSelected.includes(userId)
      ? adhocSelected.filter(id => id !== userId)
      : [...adhocSelected, userId];
    setAdhocSelected(next);
    onChange(next.length > 0 ? { type: 'adhoc', userIds: next } : null);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!value) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await bookingApi.previewNoticeboardRecipients(value);
      setPreview(res.data);
    } catch {
      setPreview({ count: 0, preview: [] });
    } finally {
      setPreviewing(false);
    }
  };

  const filteredAdhocUsers = adhocSearch.trim()
    ? adhocUsers.filter(u =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(adhocSearch.toLowerCase())
      )
    : adhocUsers.slice(0, 20);

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {!forceEnabled && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
          <input type="checkbox" checked={enabled} onChange={handleToggle} />
          <span className="bk-label" style={{ margin: 0, fontWeight: 600 }}>Notify by email</span>
        </label>
      )}

      {enabled && (
        <div style={{ marginTop: forceEnabled ? 0 : '0.5rem', padding: '0.75rem', background: 'var(--booking-bg-light)', borderRadius: 'var(--booking-radius)', border: '1px solid var(--booking-border)' }}>
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {(['preset', groups.length > 0 ? 'group' : null, 'adhoc']).filter(Boolean).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setPreview(null); }}
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.8rem',
                  border: '1px solid var(--booking-border)',
                  borderRadius: 'var(--booking-radius)',
                  background: mode === m ? 'var(--booking-accent)' : 'var(--booking-bg-white)',
                  color: mode === m ? '#fff' : 'inherit',
                  cursor: 'pointer',
                }}
              >
                {m === 'preset' ? 'Standard' : m === 'group' ? 'Saved group' : 'Ad-hoc'}
              </button>
            ))}
          </div>

          {mode === 'preset' && (
            <select
              className="bk-input"
              value={JSON.stringify(value)}
              onChange={e => handlePresetChange(JSON.parse(e.target.value))}
            >
              {STANDARD_PRESETS.map(p => (
                <option key={p.label} value={JSON.stringify(p.filter)}>{p.label}</option>
              ))}
            </select>
          )}

          {mode === 'group' && (
            <select
              className="bk-input"
              onChange={e => handleGroupChange(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Select a group…</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          {mode === 'adhoc' && (
            <div>
              <input
                className="bk-input"
                placeholder="Search by name or email…"
                value={adhocSearch}
                onChange={e => setAdhocSearch(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--booking-border)', borderRadius: 'var(--booking-radius)', background: 'var(--booking-bg-white)' }}>
                {filteredAdhocUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={adhocSelected.includes(u.id)}
                      onChange={() => handleAdhocToggle(u.id)}
                    />
                    {u.firstName} {u.lastName}
                    <span style={{ color: 'var(--booking-text-muted)', fontSize: '0.78rem' }}>{u.email}</span>
                  </label>
                ))}
              </div>
              {adhocSelected.length > 0 && (
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>
                  {adhocSelected.length} selected
                </p>
              )}
            </div>
          )}

          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="bk-btn bk-btn--sm"
              style={{ border: '1px solid var(--booking-border)' }}
              onClick={handlePreview}
              disabled={previewing || !value}
            >
              {previewing ? 'Checking…' : 'Preview recipients'}
            </button>
            {preview && (
              <span style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                {preview.count === 0
                  ? 'No recipients found'
                  : `${preview.count} recipient${preview.count !== 1 ? 's' : ''}${preview.preview.length > 0 ? `: ${preview.preview.map(r => r.name).join(', ')}${preview.count > 5 ? '…' : ''}` : ''}`
                }
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
