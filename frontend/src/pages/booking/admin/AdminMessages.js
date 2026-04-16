import React, { useEffect, useState } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import RichTextEditor from '../../../components/RichTextEditor';
import RecipientPicker from '../../../components/RecipientPicker';
import Toast from '../../../components/Toast';
import useToast from '../../../hooks/useToast';
import '../booking-shared.css';

const STATUS_COLOURS = {
  DRAFT: 'var(--booking-text-muted)',
  SCHEDULED: 'var(--booking-accent)',
  SENDING: '#f39c12',
  SENT: 'var(--booking-booked)',
  FAILED: 'var(--booking-danger)',
};

const defaultFilter = () => ({ type: 'all' });

function MessageRecipientList({ messageId }) {
  const [recipients, setRecipients] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (recipients) { setOpen(o => !o); return; }
    setLoading(true);
    setOpen(true);
    try {
      const r = await bookingApi.getMessage(messageId);
      setRecipients(r.data.recipients || []);
    } catch {
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        className="bk-btn bk-btn--sm"
        style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', border: '1px solid var(--booking-border)' }}
        onClick={load}
      >
        {open ? 'Hide recipients' : 'Show recipients'}
      </button>
      {open && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>
          {loading ? 'Loading…' : recipients && recipients.length === 0 ? 'No recipients recorded.' : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {recipients.map(r => (
                <div key={r.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span>{r.email}</span>
                  <span style={{ color: r.status === 'SENT' ? 'var(--booking-booked)' : r.status === 'FAILED' ? 'var(--booking-danger)' : 'inherit', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    {r.status}
                  </span>
                  {r.error && <span style={{ color: 'var(--booking-danger)' }}>{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(null); // message id being edited
  const [form, setForm] = useState({ subject: '', htmlBody: '', recipientFilter: defaultFilter(), scheduledAt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toast, showToast, dismissToast } = useToast();

  const load = () => {
    setLoading(true);
    bookingApi.getMessages()
      .then(r => setMessages(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    bookingApi.getRecipientGroups().then(r => setGroups(r.data)).catch(() => {});
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ subject: '', htmlBody: '', recipientFilter: defaultFilter(), scheduledAt: '' });

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

    setError('');
    setComposing(true);
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
      showToast('Failed to send', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    try {
      await bookingApi.deleteMessage(id);
      load();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  if (loading) return <p className="bk-muted">Loading...</p>;

  if (composing) {
    return (
      <div className="bk-page bk-page--xl">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="bk-btn" onClick={() => setComposing(false)}>← Back</button>
          <h2 style={{ margin: 0 }}>{editing ? 'Edit Message' : 'New Message'}</h2>
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
            <RecipientPicker
              forceEnabled={true}
              value={form.recipientFilter}
              onChange={rf => setForm(f => ({ ...f, recipientFilter: rf }))}
              groups={groups}
            />
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
        <button className="bk-btn bk-btn-primary" onClick={openNew}>New Message</button>
      </div>

      {messages.length === 0 ? (
        <p className="bk-muted">No messages yet.</p>
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
                  {msg.status === 'SENT' && <MessageRecipientList messageId={msg.id} />}
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
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}
