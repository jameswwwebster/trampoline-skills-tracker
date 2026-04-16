import React, { useState, useEffect } from 'react';
import { bookingApi, getTemplates } from '../../../utils/bookingApi';
import Toast from '../../../components/Toast';
import useToast from '../../../hooks/useToast';
import '../booking-shared.css';

const STATUS_LABELS = {
  SCHEDULED: { label: 'Scheduled', color: '#1565c0' },
  PENDING_PAYMENT: { label: 'Awaiting payment setup', color: 'var(--booking-warning, #e67e22)' },
  ACTIVE: { label: 'Active', color: 'var(--booking-success)' },
  PAUSED: { label: 'Paused', color: 'var(--booking-text-muted)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--booking-danger)' },
};

export default function AdminMemberships() {
  const [memberships, setMemberships] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [form, setForm] = useState({ gymnastId: '', monthlyAmount: '', startDate: '', templateIds: [], chargeFullMonth: false });
  const [templates, setTemplates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [showResetPicker, setShowResetPicker] = useState(false);
  const [resetSelected, setResetSelected] = useState([]);
  const [resetSkipEmail, setResetSkipEmail] = useState(false);
  const [cancellingOverdue, setCancellingOverdue] = useState(false);
  const [cancelOverdueResult, setCancelOverdueResult] = useState(null);
  const { toast, showToast, dismissToast } = useToast();

  const load = () => {
    bookingApi.getMemberships().then(res => setMemberships(res.data));
    getTemplates().then(res => setTemplates(res.data));
    const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
    fetch(`${API_URL}/gymnasts`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(data => setGymnasts(Array.isArray(data) ? data : data.gymnasts || []));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitMsg(null);
    if (form.templateIds.length === 0) {
      setError('Please select at least one standing slot session.');
      setSubmitting(false);
      return;
    }
    try {
      const monthlyPence = Math.round(parseFloat(form.monthlyAmount) * 100);
      const payload = {
        gymnastId: form.gymnastId,
        monthlyAmount: monthlyPence,
        startDate: form.startDate,
        templateIds: form.templateIds,
      };
      if (form.chargeFullMonth) payload.firstMonthAmount = monthlyPence;
      const res = await bookingApi.createMembership(payload);
      setForm({ gymnastId: '', monthlyAmount: '', startDate: '', templateIds: [], chargeFullMonth: false });
      setSubmitMsg(res.data.clientSecret
        ? 'Membership created. The member will see a payment setup prompt in their account.'
        : 'Membership created.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create membership.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await bookingApi.updateMembership(id, { status });
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update membership.', 'error');
    }
  };

  const handleEditAmount = async (id) => {
    const pence = Math.round(parseFloat(editAmount) * 100);
    if (!pence || pence < 1) { showToast('Enter a valid amount.', 'error'); return; }
    try {
      await bookingApi.updateMembership(id, { monthlyAmount: pence });
      setEditingId(null);
      setEditAmount('');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update amount.', 'error');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this membership? This will stop Stripe billing immediately.')) return;
    try {
      await bookingApi.deleteMembership(id);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to cancel membership.', 'error');
    }
  };

  const openResetPicker = () => {
    const overdue = memberships.filter(m => m.status === 'PENDING_PAYMENT');
    setResetSelected(overdue.map(m => m.id));
    setShowResetPicker(true);
    setCancelOverdueResult(null);
  };

  const handleResetSelected = async () => {
    if (resetSelected.length === 0) return;
    setCancellingOverdue(true);
    setShowResetPicker(false);
    let reset = 0;
    let failed = 0;
    for (const id of resetSelected) {
      try {
        await bookingApi.resetMembership(id, resetSkipEmail);
        reset++;
      } catch {
        failed++;
      }
    }
    setCancelOverdueResult(`Reset ${reset}${failed > 0 ? `, ${failed} failed` : ''}.`);
    setCancellingOverdue(false);
    load();
  };

  const handleNotifyScheduled = async () => {
    const scheduled = memberships.filter(m => m.status === 'SCHEDULED' && !m.scheduledNotifiedAt);
    if (!window.confirm(`Send a "membership scheduled" email to ${scheduled.length} guardian${scheduled.length !== 1 ? 's' : ''}?`)) return;
    setNotifying(true);
    setNotifyResult(null);
    try {
      const res = await bookingApi.notifyScheduledMemberships();
      setNotifyResult(`Sent ${res.data.sent} email${res.data.sent !== 1 ? 's' : ''}${res.data.skipped > 0 ? `, ${res.data.skipped} skipped (no guardian email)` : ''}.`);
    } catch (err) {
      setNotifyResult('Failed to send notifications.');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="bk-page bk-page--lg">
      <h2>Memberships</h2>

      <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Add member</h3>
        <div className="bk-grid-2">
          <label className="bk-label">Gymnast
            <select value={form.gymnastId} onChange={e => setForm(f => ({ ...f, gymnastId: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }}>
              <option value="">Select gymnast</option>
              {gymnasts.filter(g => !g.isArchived).map(g => <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>)}
            </select>
          </label>
          <label className="bk-label">Monthly amount (£)
            <input type="number" step="0.01" min="0" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} required placeholder="e.g. 40.00" className="bk-input" style={{ marginTop: '0.25rem' }} />
          </label>
        </div>
        <label className="bk-label">Start date
          <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={form.chargeFullMonth} onChange={e => setForm(f => ({ ...f, chargeFullMonth: e.target.checked }))} />
          Charge full month (no proration) — use when the member is paying for a full calendar month regardless of start date
        </label>
        <label className="bk-label">Standing slots
          <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {templates.filter(t => t.isActive).map(t => {
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const label = `${days[t.dayOfWeek]} ${t.startTime}–${t.endTime}`;
              const checked = form.templateIds.includes(t.id);
              return (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="auth-checkbox"
                    checked={checked}
                    onChange={() => setForm(f => ({
                      ...f,
                      templateIds: checked ? f.templateIds.filter(id => id !== t.id) : [...f.templateIds, t.id],
                    }))}
                  />
                  {label}{t.type === 'DMT' ? ' · DMT' : ' · Trampoline'}
                </label>
              );
            })}
            {templates.length === 0 && <span className="bk-muted" style={{ fontSize: '0.85rem' }}>No session templates found</span>}
          </div>
        </label>
        {error && <p className="bk-error">{error}</p>}
        {submitMsg && <p style={{ color: 'var(--booking-success)', fontSize: '0.875rem' }}>{submitMsg}</p>}
        <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
          {submitting ? 'Creating...' : 'Add member'}
        </button>
      </form>

      {memberships.some(m => m.status === 'SCHEDULED' && !m.scheduledNotifiedAt) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className="bk-btn bk-btn--ghost"
            style={{ fontSize: '0.85rem' }}
            disabled={notifying}
            onClick={handleNotifyScheduled}
          >
            {notifying ? 'Sending…' : `Notify scheduled members (${memberships.filter(m => m.status === 'SCHEDULED' && !m.scheduledNotifiedAt).length})`}
          </button>
          {notifyResult && <span style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>{notifyResult}</span>}
        </div>
      )}

      {memberships.some(m => m.status === 'PENDING_PAYMENT') && (
        <div style={{ marginBottom: '1rem' }}>
          {!showResetPicker ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="bk-btn bk-btn--ghost"
                style={{ fontSize: '0.85rem', color: 'var(--booking-danger)', borderColor: 'var(--booking-danger)' }}
                disabled={cancellingOverdue}
                onClick={openResetPicker}
              >
                {cancellingOverdue ? 'Resetting…' : `Reset overdue memberships…`}
              </button>
              {cancelOverdueResult && <span style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>{cancelOverdueResult}</span>}
            </div>
          ) : (
            <div className="bk-card" style={{ maxWidth: 420 }}>
              <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.9rem' }}>Select people to reset</p>
              <p className="bk-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>Each selected membership will be cancelled and recreated with the same amount starting today. Guardians will receive an email to set up payment.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {memberships.filter(m => m.status === 'PENDING_PAYMENT').map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={resetSelected.includes(m.id)}
                      onChange={() => setResetSelected(s => s.includes(m.id) ? s.filter(id => id !== m.id) : [...s, m.id])}
                    />
                    {m.gymnast.firstName} {m.gymnast.lastName}
                    <span className="bk-muted" style={{ fontSize: '0.8rem' }}>£{(m.monthlyAmount / 100).toFixed(2)}/mo</span>
                  </label>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={resetSkipEmail} onChange={e => setResetSkipEmail(e.target.checked)} />
                <span>Don't send email notifications</span>
              </label>
              <div className="bk-row" style={{ gap: '0.5rem' }}>
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ background: 'var(--booking-danger)', color: '#fff', border: 'none' }}
                  disabled={resetSelected.length === 0}
                  onClick={handleResetSelected}
                >
                  Reset {resetSelected.length > 0 ? `${resetSelected.length} ` : ''}selected
                </button>
                <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={() => setShowResetPicker(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="bk-input"
          style={{ maxWidth: 220 }}
          placeholder="Search by name…"
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
        />
        <select className="bk-input" style={{ maxWidth: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
          <option value="CANCELLED">Cancelled</option>
        </select>
        {(nameSearch || statusFilter) && (
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={() => { setNameSearch(''); setStatusFilter(''); }}>Clear</button>
        )}
      </div>

      {(() => {
        const filtered = memberships.filter(m => {
          if (statusFilter && m.status !== statusFilter) return false;
          if (!statusFilter && m.status === 'CANCELLED') return false;
          if (nameSearch) {
            const q = nameSearch.toLowerCase();
            if (!`${m.gymnast.firstName} ${m.gymnast.lastName}`.toLowerCase().includes(q)) return false;
          }
          return true;
        });
        return filtered.length === 0 ? <p className="bk-muted">No memberships.</p> : null;
      })()}
      {memberships.length > 0 && (() => {
        const filtered = memberships.filter(m => {
          if (statusFilter && m.status !== statusFilter) return false;
          if (!statusFilter && m.status === 'CANCELLED') return false;
          if (nameSearch) {
            const q = nameSearch.toLowerCase();
            if (!`${m.gymnast.firstName} ${m.gymnast.lastName}`.toLowerCase().includes(q)) return false;
          }
          return true;
        });
        if (filtered.length === 0) return null;
        return (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Gymnast</th>
              <th style={{ textAlign: 'right' }}>Monthly</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const s = STATUS_LABELS[m.status] || { label: m.status, color: 'inherit' };
              return (
                <tr key={m.id}>
                  <td>{m.gymnast.firstName} {m.gymnast.lastName}</td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === m.id ? (
                      <div className="bk-row" style={{ justifyContent: 'flex-end' }}>
                        <span style={{ marginRight: '0.25rem' }}>£</span>
                        <input
                          type="number" step="0.01" min="0.01"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="bk-input"
                          style={{ width: '5rem', padding: '0.2rem 0.4rem', fontSize: '0.875rem' }}
                          autoFocus
                        />
                        <button onClick={() => handleEditAmount(m.id)} className="bk-btn bk-btn--sm bk-btn--primary">Save</button>
                        <button onClick={() => { setEditingId(null); setEditAmount(''); }} className="bk-btn bk-btn--sm">✕</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                        title="Click to edit"
                        onClick={() => { setEditingId(m.id); setEditAmount((m.monthlyAmount / 100).toFixed(2)); }}
                      >
                        £{(m.monthlyAmount / 100).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td><span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</span></td>
                  <td>
                    <div className="bk-row">
                      {m.status === 'ACTIVE' && (
                        <button onClick={() => handleStatusChange(m.id, 'PAUSED')} className="bk-btn bk-btn--sm">Pause</button>
                      )}
                      {m.status === 'PAUSED' && (
                        <button onClick={() => handleStatusChange(m.id, 'ACTIVE')} className="bk-btn bk-btn--sm bk-btn--primary">Resume</button>
                      )}
                      {m.status !== 'CANCELLED' && (
                        <button onClick={() => handleCancel(m.id)} className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        );
      })()}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}
