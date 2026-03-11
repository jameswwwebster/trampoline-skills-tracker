import React, { useEffect, useState } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import RichTextEditor from '../../../components/RichTextEditor';
import '../booking-shared.css';

const STATUS_COLOURS = {
  DRAFT: 'var(--booking-text-muted)',
  SCHEDULED: 'var(--booking-accent)',
  SENDING: '#f39c12',
  SENT: 'var(--booking-booked)',
  FAILED: 'var(--booking-danger)',
};

const FILTER_TYPES = [
  { value: 'all', label: 'All members' },
  { value: 'role', label: 'By role' },
  { value: 'session', label: 'Session attendees' },
  { value: 'active_membership', label: 'Active membership' },
  { value: 'expiring_credits', label: 'Expiring credits' },
  { value: 'no_upcoming_bookings', label: 'No upcoming bookings' },
];

const defaultFilter = () => ({ type: 'all' });

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(null); // message id being edited
  const [form, setForm] = useState({ subject: '', htmlBody: '', recipientFilter: defaultFilter(), scheduledAt: '' });
  const [preview, setPreview] = useState(null); // { count, users }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    bookingApi.getMessages()
      .then(r => setMessages(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ subject: '', htmlBody: '', recipientFilter: defaultFilter(), scheduledAt: '' });
    setPreview(null);
    setError('');
    setComposing(true);
  };

  const openEdit = (msg) => {
    setEditing(msg.id);
    setForm({
      subject: msg.subject,
      htmlBody: msg.htmlBody,
      recipientFilter: msg.recipientFilter,
      scheduledAt: msg.scheduledAt ? new Date(msg.scheduledAt).toISOString().slice(0, 16) : '',
    });
    setPreview(null);
    setError('');
    setComposing(true);
  };

  const handlePreview = async () => {
    try {
      const r = await bookingApi.previewRecipients(form.recipientFilter);
      setPreview(r.data);
    } catch {
      setError('Failed to preview recipients');
    }
  };

  const handleSave = async (sendNow = false) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        subject: form.subject,
        htmlBody: form.htmlBody,
        recipientFilter: form.recipientFilter,
        scheduledAt: form.scheduledAt || null,
      };
      let saved;
      if (editing) {
        saved = await bookingApi.updateMessage(editing, payload);
      } else {
        saved = await bookingApi.createMessage(payload);
      }
      if (sendNow) {
        await bookingApi.sendMessage(saved.data.id);
      }
      setComposing(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async (id) => {
    if (!window.confirm('Send this message now?')) return;
    try {
      await bookingApi.sendMessage(id);
      load();
    } catch {
      alert('Failed to send');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    try {
      await bookingApi.deleteMessage(id);
      load();
    } catch {
      alert('Failed to delete');
    }
  };

  const setFilterField = (key, value) => {
    setForm(f => ({ ...f, recipientFilter: { ...f.recipientFilter, [key]: value } }));
  };

  const setFilterType = (type) => {
    setForm(f => ({ ...f, recipientFilter: { type } }));
    setPreview(null);
  };

  const renderFilterBuilder = () => {
    const ft = form.recipientFilter.type;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <select
          className="bk-input"
          value={ft || 'all'}
          onChange={e => setFilterType(e.target.value)}
        >
          {FILTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {ft === 'role' && (
          <select className="bk-input" value={form.recipientFilter.role || 'PARENT'} onChange={e => setFilterField('role', e.target.value)}>
            <option value="PARENT">Parents</option>
            <option value="COACH">Coaches</option>
          </select>
        )}
        {(ft === 'expiring_credits' || ft === 'no_upcoming_bookings') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem' }}>Within days:</label>
            <input
              type="number"
              className="bk-input"
              style={{ width: '5rem' }}
              value={form.recipientFilter.withinDays || 30}
              onChange={e => setFilterField('withinDays', parseInt(e.target.value, 10))}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) return <p className="bk-muted">Loading...</p>;

  if (composing) {
    return (
      <div className="bk-page bk-page--xl">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="bk-btn" onClick={() => setComposing(false)}>← Back</button>
          <h2 style={{ margin: 0 }}>{editing ? 'Edit Campaign' : 'New Campaign'}</h2>
        </div>

        {error && <p style={{ color: 'var(--booking-danger)', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>
          <div>
            <label className="bk-label">Subject</label>
            <input
              className="bk-input"
              style={{ width: '100%' }}
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Email subject line"
            />
          </div>

          <div>
            <label className="bk-label">Body</label>
            <RichTextEditor
              value={form.htmlBody}
              onChange={html => setForm(f => ({ ...f, htmlBody: html }))}
              placeholder="Write your email..."
            />
          </div>

          <div>
            <label className="bk-label">Recipients</label>
            {renderFilterBuilder()}
            <button
              className="bk-btn"
              style={{ marginTop: '0.5rem' }}
              onClick={handlePreview}
            >
              Preview recipients
            </button>
            {preview && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
                {preview.count} recipient{preview.count !== 1 ? 's' : ''}
                {preview.users.length > 0 && `: ${preview.users.slice(0, 5).map(u => u.firstName).join(', ')}${preview.count > 5 ? ` +${preview.count - 5} more` : ''}`}
              </p>
            )}
          </div>

          <div>
            <label className="bk-label">Schedule (optional)</label>
            <input
              type="datetime-local"
              className="bk-input"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--booking-text-muted)', marginTop: '0.25rem' }}>
              Leave blank to save as draft
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="bk-btn bk-btn-primary" disabled={saving} onClick={() => handleSave(false)}>
              {form.scheduledAt ? 'Schedule' : 'Save Draft'}
            </button>
            <button className="bk-btn bk-btn-primary" disabled={saving} onClick={() => handleSave(true)}>
              Send Now
            </button>
            <button className="bk-btn" disabled={saving} onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-page bk-page--xl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Messages</h2>
        <button className="bk-btn bk-btn-primary" onClick={openNew}>New Campaign</button>
      </div>

      {messages.length === 0 ? (
        <p className="bk-muted">No campaigns yet. Create your first campaign above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {messages.map(msg => (
            <div key={msg.id} className="bk-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{msg.subject}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: STATUS_COLOURS[msg.status] || 'inherit',
                      textTransform: 'uppercase',
                    }}>
                      {msg.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>
                    By {msg.author?.firstName} {msg.author?.lastName}
                    {msg.sentAt && ` · Sent ${new Date(msg.sentAt).toLocaleDateString('en-GB')}`}
                    {msg.scheduledAt && !msg.sentAt && ` · Scheduled for ${new Date(msg.scheduledAt).toLocaleString('en-GB')}`}
                    {msg.recipientCount > 0 && ` · ${msg.recipientCount} recipients`}
                  </div>
                </div>
                {['DRAFT', 'SCHEDULED'].includes(msg.status) && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button className="bk-btn" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => openEdit(msg)}>Edit</button>
                    <button className="bk-btn bk-btn-primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleSendNow(msg.id)}>Send Now</button>
                    <button className="bk-btn" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', color: 'var(--booking-danger)' }} onClick={() => handleDelete(msg.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
