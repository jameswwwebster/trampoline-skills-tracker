import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATUS_LABELS = {
  INVITED: { label: 'Invited', color: '#1565c0' },
  PAYMENT_PENDING: { label: 'Awaiting payment', color: 'var(--booking-warning, #e67e22)' },
  PAID: { label: 'Paid', color: 'var(--booking-success)' },
  DECLINED: { label: 'Declined', color: 'var(--booking-text-muted)' },
};

export default function AdminCompetitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [tab, setTab] = useState('details');
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const res = await bookingApi.getCompetitionEvent(id);
    setEvent(res.data);
  };

  const loadEligible = async () => {
    const res = await bookingApi.getEligibleGymnasts(id);
    setEligible(res.data);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (tab === 'invites') loadEligible(); }, [tab]);

  const saveField = async (field, rawValue) => {
    setSaving(true);
    setMsg(null);
    try {
      let value = rawValue;
      if (field === 'lateEntryFee') value = rawValue === '' ? null : Math.round(parseFloat(rawValue) * 100);
      await bookingApi.updateCompetitionEvent(id, { [field]: value });
      setEditField(null);
      await load();
      setMsg('Saved.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (gymnastId) => {
    setInviting(true);
    try {
      await bookingApi.inviteGymnasts(id, [gymnastId]);
      await load();
      setEligible(prev => prev.map(cat => ({
        ...cat,
        gymnasts: cat.gymnasts.map(g => g.id === gymnastId ? { ...g, alreadyInvited: true } : g),
      })));
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to invite.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveEntry = async (entryId) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await bookingApi.deleteCompetitionEntry(entryId);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to remove entry.');
    }
  };

  const handleCoachConfirm = async (entryId, current) => {
    try {
      await bookingApi.updateCompetitionEntry(entryId, { coachConfirmed: !current });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to update.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this competition? All entries will be removed.')) return;
    try {
      await bookingApi.deleteCompetitionEvent(id);
      navigate('/booking/admin/competitions');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to delete.');
    }
  };

  if (!event) return <div className="bk-page"><p className="bk-muted">Loading...</p></div>;

  const entryCountByStatus = event.entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bk-page bk-page--lg">
      <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.85rem', marginBottom: '1rem' }} onClick={() => navigate('/booking/admin/competitions')}>
        ← Competitions
      </button>

      <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem' }}>{event.name}</h2>
          <p className="bk-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            {event.location} · {new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={handleDelete}>Delete</button>
      </div>

      {msg && <p style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>{msg}</p>}

      <div className="bk-row" style={{ gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--booking-border)', paddingBottom: '0' }}>
        {['details', 'invites', 'entries'].map(t => (
          <button
            key={t}
            className="bk-btn bk-btn--ghost"
            style={{
              fontSize: '0.875rem',
              borderBottom: tab === t ? '2px solid var(--booking-primary)' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: '0.6rem',
            }}
            onClick={() => { setTab(t); setMsg(null); }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'entries' && event.entries.length > 0 && ` (${event.entries.length})`}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <DetailsTab
          event={event}
          editField={editField}
          editValue={editValue}
          saving={saving}
          onEdit={(field, val) => { setEditField(field); setEditValue(val); setMsg(null); }}
          onSave={saveField}
          onCancel={() => setEditField(null)}
          onEditValueChange={setEditValue}
        />
      )}

      {tab === 'invites' && (
        <InvitesTab
          eligible={eligible}
          inviting={inviting}
          onInvite={handleInvite}
        />
      )}

      {tab === 'entries' && (
        <EntriesTab
          event={event}
          entryCountByStatus={entryCountByStatus}
          onRemove={handleRemoveEntry}
          onCoachConfirm={handleCoachConfirm}
        />
      )}
    </div>
  );
}

function DetailsTab({ event, editField, editValue, saving, onEdit, onSave, onCancel, onEditValueChange }) {
  const fields = [
    { key: 'name', label: 'Name', type: 'text', display: event.name },
    { key: 'location', label: 'Location', type: 'text', display: event.location },
    { key: 'startDate', label: 'Start date', type: 'date', display: new Date(event.startDate).toLocaleDateString('en-GB') },
    { key: 'endDate', label: 'End date', type: 'date', display: event.endDate ? new Date(event.endDate).toLocaleDateString('en-GB') : '—' },
    { key: 'entryDeadline', label: 'Entry deadline', type: 'date', display: new Date(event.entryDeadline).toLocaleDateString('en-GB') },
    {
      key: 'lateEntryFee',
      label: 'Late entry fee',
      type: 'number',
      display: event.lateEntryFee !== null ? `£${(event.lateEntryFee / 100).toFixed(2)}` : 'None (hard deadline)',
      editVal: event.lateEntryFee !== null ? (event.lateEntryFee / 100).toFixed(2) : '',
    },
  ];

  return (
    <div>
      <table className="bk-table" style={{ maxWidth: 600, marginBottom: '1.5rem' }}>
        <tbody>
          {fields.map(f => (
            <tr key={f.key}>
              <td style={{ fontWeight: 500, width: '160px' }}>{f.label}</td>
              <td>
                {editField === f.key ? (
                  <div className="bk-row" style={{ gap: '0.5rem' }}>
                    <input
                      type={f.type}
                      step={f.type === 'number' ? '0.01' : undefined}
                      min={f.type === 'number' ? '0' : undefined}
                      className="bk-input"
                      style={{ maxWidth: 200 }}
                      value={editValue}
                      onChange={e => onEditValueChange(e.target.value)}
                      autoFocus
                    />
                    <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving} onClick={() => onSave(f.key, editValue)}>Save</button>
                    <button className="bk-btn bk-btn--sm" onClick={onCancel}>Cancel</button>
                  </div>
                ) : (
                  <span
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                    title="Click to edit"
                    onClick={() => onEdit(f.key, f.editVal !== undefined ? f.editVal : f.display)}
                  >
                    {f.display}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Price tiers</p>
        <table className="bk-table" style={{ maxWidth: 300 }}>
          <thead><tr><th>Entry</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
          <tbody>
            {event.priceTiers.map(t => (
              <tr key={t.id}>
                <td>{t.entryNumber === 1 ? '1st' : t.entryNumber === 2 ? '2nd' : '3rd+'}</td>
                <td style={{ textAlign: 'right' }}>£{(t.price / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Categories</p>
        {event.categories.map(cat => (
          <div key={cat.id} style={{ fontSize: '0.875rem', marginBottom: '0.35rem' }}>
            <span style={{ fontWeight: 500 }}>{cat.name}</span>
            {cat.skillCompetitions?.length > 0 && (
              <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                ({cat.skillCompetitions.length} skill level{cat.skillCompetitions.length !== 1 ? 's' : ''} linked)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitesTab({ eligible, inviting, onInvite }) {
  if (eligible.length === 0) return <p className="bk-muted">Loading eligible gymnasts...</p>;

  return (
    <div>
      <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Recommended gymnasts have completed the linked skill tracker levels. You can invite anyone regardless.
      </p>
      {eligible.map(cat => (
        <div key={cat.categoryId} style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{cat.categoryName}</h4>
          {cat.gymnasts.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem' }}>No eligible gymnasts found.</p>}
          {cat.gymnasts.length > 0 && (
            <table className="bk-table">
              <tbody>
                {cat.gymnasts.map(g => (
                  <tr key={g.id}>
                    <td>{g.firstName} {g.lastName}</td>
                    <td>
                      {g.alreadyInvited ? (
                        <span style={{ color: 'var(--booking-success)', fontSize: '0.85rem', fontWeight: 600 }}>Invited</span>
                      ) : (
                        <button
                          className="bk-btn bk-btn--sm bk-btn--primary"
                          disabled={inviting}
                          onClick={() => onInvite(g.id)}
                        >
                          Invite
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function EntriesTab({ event, entryCountByStatus, onRemove, onCoachConfirm }) {
  return (
    <div>
      {Object.keys(entryCountByStatus).length > 0 && (
        <div className="bk-row" style={{ gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(entryCountByStatus).map(([status, count]) => {
            const s = STATUS_LABELS[status] || { label: status, color: 'inherit' };
            return (
              <div key={status} style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: s.color }}>{count}</span>
                <span className="bk-muted"> {s.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {event.entries.length === 0 && <p className="bk-muted">No entries yet.</p>}

      {event.entries.length > 0 && (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Gymnast</th>
              <th>Categories</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {event.entries.map(entry => {
              const s = STATUS_LABELS[entry.status] || { label: entry.status, color: 'inherit' };
              return (
                <tr key={entry.id}>
                  <td>{entry.gymnast.firstName} {entry.gymnast.lastName}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>
                    {entry.categories.length > 0
                      ? entry.categories.map(ec => ec.category.name).join(', ')
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {entry.totalAmount !== null ? `£${(entry.totalAmount / 100).toFixed(2)}` : '—'}
                  </td>
                  <td><span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</span></td>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={entry.coachConfirmed}
                        onChange={() => onCoachConfirm(entry.id, entry.coachConfirmed)}
                      />
                      {entry.coachConfirmed ? 'Done' : 'Confirm'}
                    </label>
                  </td>
                  <td>
                    {entry.status !== 'PAID' && (
                      <button
                        className="bk-btn bk-btn--sm"
                        style={{ color: 'var(--booking-danger)', fontSize: '0.8rem' }}
                        onClick={() => onRemove(entry.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
