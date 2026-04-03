import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import RecipientPicker from '../../../components/RecipientPicker';
import '../booking-shared.css';

const EMPTY_FORM = { name: '', recipientFilter: { type: 'all' } };

const FILTER_SUMMARY = {
  all: 'All members',
  role: f => `Role: ${f.role}`,
  active_membership: 'Active membership',
  pending_payment_membership: 'Overdue subscriptions',
  expiring_credits: 'Expiring credits',
  no_upcoming_bookings: 'No upcoming bookings',
  adhoc: f => `${f.userIds?.length ?? 0} specific people`,
};

function filterLabel(filter) {
  const val = FILTER_SUMMARY[filter?.type];
  return typeof val === 'function' ? val(filter) : (val || filter?.type || 'Unknown');
}

function GroupForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.recipientFilter) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="bk-card" style={{ marginBottom: '1rem' }}>
      <h4 style={{ margin: '0 0 0.75rem' }}>{initial ? 'Edit group' : 'New group'}</h4>
      <form onSubmit={handleSubmit}>
        <label className="bk-label" style={{ display: 'block', marginBottom: '0.75rem' }}>
          Group name
          <input
            className="bk-input"
            style={{ marginTop: '0.25rem' }}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            maxLength={100}
            placeholder="e.g. Tuesday regulars"
          />
        </label>
        <div style={{ marginBottom: '0.75rem' }}>
          <p className="bk-label" style={{ margin: '0 0 0.25rem' }}>Audience</p>
          <RecipientPicker
            value={form.recipientFilter}
            onChange={rf => setForm(f => ({ ...f, recipientFilter: rf || { type: 'all' } }))}
            groups={[]}
            forceEnabled
          />
        </div>
        {error && <p className="bk-error">{error}</p>}
        <div className="bk-row">
          <button type="submit" disabled={saving} className="bk-btn bk-btn--primary bk-btn--sm">
            {saving ? 'Saving…' : 'Save group'}
          </button>
          <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminRecipientGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () =>
    bookingApi.getRecipientGroups()
      .then(r => setGroups(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async (form) => {
    await bookingApi.createRecipientGroup(form);
    setShowForm(false);
    load();
  };

  const handleUpdate = async (form) => {
    await bookingApi.updateRecipientGroup(editingId, form);
    setEditingId(null);
    load();
  };

  const handleDelete = async (id) => {
    await bookingApi.deleteRecipientGroup(id);
    setConfirmDelete(null);
    load();
  };

  if (loading) return <p className="bk-center">Loading…</p>;

  return (
    <div className="bk-page bk-page--md">
      <div className="bk-row bk-row--between" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Recipient Groups</h2>
        {!showForm && !editingId && (
          <button className="bk-btn bk-btn--primary" onClick={() => setShowForm(true)}>
            + New group
          </button>
        )}
      </div>

      {showForm && <GroupForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {groups.length === 0 && !showForm && (
        <p className="bk-muted">No saved groups yet. Create one to reuse it when sending noticeboard emails.</p>
      )}

      {groups.map(group => (
        editingId === group.id ? (
          <GroupForm
            key={group.id}
            initial={{ name: group.name, recipientFilter: group.recipientFilter }}
            onSave={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={group.id} className="bk-card" style={{ marginBottom: '0.75rem' }}>
            <div className="bk-row bk-row--between">
              <div>
                <strong>{group.name}</strong>
                <span className="bk-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                  {filterLabel(group.recipientFilter)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => { setEditingId(group.id); setShowForm(false); }}
                >
                  Edit
                </button>
                {confirmDelete === group.id ? (
                  <>
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ background: 'var(--booking-danger)', color: '#fff', border: 'none' }}
                      onClick={() => handleDelete(group.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ border: '1px solid var(--booking-border)' }}
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                    onClick={() => setConfirmDelete(group.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  );
}
