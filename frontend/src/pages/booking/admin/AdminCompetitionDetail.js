import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATUS_LABELS = {
  INVITED: { label: 'Invited', color: '#1565c0' },
  ACCEPTED: { label: 'Accepted — awaiting review', color: '#7c35e8' },
  PAYMENT_PENDING: { label: 'Invoice sent', color: 'var(--booking-warning, #e67e22)' },
  PAID: { label: 'Paid', color: 'var(--booking-success)' },
  DECLINED: { label: 'Declined', color: 'var(--booking-text-muted)' },
  WAIVED: { label: 'Waived', color: 'var(--booking-success)' },
};

export default function AdminCompetitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [eligible, setEligible] = useState(null); // null = not yet loaded
  const [eligibleError, setEligibleError] = useState(null);
  const [allGymnasts, setAllGymnasts] = useState(null);
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
    setEligible(null);
    setAllGymnasts(null);
    setEligibleError(null);
    try {
      const [eligibleRes, allRes] = await Promise.all([
        bookingApi.getEligibleGymnasts(id),
        bookingApi.getAllCompetitionGymnasts(id),
      ]);
      setEligible(eligibleRes.data);
      setAllGymnasts(allRes.data);
    } catch (err) {
      setEligibleError(err.response?.data?.error || 'Failed to load gymnasts.');
      setEligible([]);
      setAllGymnasts([]);
    }
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

  const handleAddCategory = async (name) => {
    try {
      await bookingApi.addCompetitionCategory(id, { name, skillCompetitionIds: [] });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to add category.');
    }
  };

  const handleRenameCategory = async (catId, name) => {
    try {
      await bookingApi.updateCompetitionCategory(id, catId, { name });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to rename category.');
    }
  };

  const handleRemoveCategory = async (catId) => {
    if (!window.confirm('Remove this category? Gymnasts who selected only this category will lose their selection.')) return;
    try {
      await bookingApi.deleteCompetitionCategory(id, catId);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to remove category.');
    }
  };

  const handleInvite = async (gymnastId, categoryIds = [], priceOverride = null) => {
    setInviting(true);
    try {
      await bookingApi.inviteGymnasts(id, [gymnastId], categoryIds, priceOverride);
      const [, allRes] = await Promise.all([load(), bookingApi.getAllCompetitionGymnasts(id)]);
      setAllGymnasts(allRes.data);
      setEligible(prev => prev ? prev.map(cat => ({
        ...cat,
        gymnasts: cat.gymnasts.map(g => g.id === gymnastId ? { ...g, alreadyInvited: true } : g),
      })) : prev);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to invite.');
    } finally {
      setInviting(false);
    }
  };

  const handleUninvite = async (entryId, gymnastId) => {
    if (!window.confirm('Remove this invitation?')) return;
    try {
      await bookingApi.deleteCompetitionEntry(entryId);
      const [, allRes] = await Promise.all([load(), bookingApi.getAllCompetitionGymnasts(id)]);
      setAllGymnasts(allRes.data);
      setEligible(prev => prev ? prev.map(cat => ({
        ...cat,
        gymnasts: cat.gymnasts.map(g => g.id === gymnastId ? { ...g, alreadyInvited: false } : g),
      })) : prev);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to remove invitation.');
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

  const handleConfirmInvoice = async (entryId, priceOverride) => {
    try {
      await bookingApi.confirmAndSendInvoice(entryId, priceOverride);
      await load();
      setMsg('Invoice sent.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to confirm.');
    }
  };

  const handleResendInvoice = async (entryId) => {
    try {
      await bookingApi.resendCompetitionInvoice(entryId);
      setMsg('Invoice resent.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to resend.');
    }
  };

  const handleWaive = async (entryId, reason) => {
    try {
      await bookingApi.waiveCompetitionEntry(entryId, reason);
      await load();
      setMsg('Entry waived.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to waive.');
    }
  };

  const handleMarkPaid = async (entryId, amount, note) => {
    try {
      await bookingApi.markCompetitionEntryPaid(entryId, amount, note);
      await load();
      setMsg('Entry marked as paid.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to mark paid.');
    }
  };

  const handleToggleSubmitted = async (entryId, current) => {
    try {
      await bookingApi.updateCompetitionEntry(entryId, { submittedToOrganiser: !current });
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
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
          onRemoveCategory={handleRemoveCategory}
        />
      )}

      {tab === 'invites' && (
        <InvitesTab
          eligible={eligible}
          eligibleError={eligibleError}
          allGymnasts={allGymnasts}
          inviting={inviting}
          onInvite={handleInvite}
          onUninvite={handleUninvite}
          eventEntries={event.entries}
          eventCategories={event.categories}
        />
      )}

      {tab === 'entries' && (
        <EntriesTab
          event={event}
          entryCountByStatus={entryCountByStatus}
          onRemove={handleRemoveEntry}
          onConfirmInvoice={handleConfirmInvoice}
          onResendInvoice={handleResendInvoice}
          onWaive={handleWaive}
          onMarkPaid={handleMarkPaid}
          onToggleSubmitted={handleToggleSubmitted}
        />
      )}
    </div>
  );
}

function DetailsTab({ event, editField, editValue, saving, onEdit, onSave, onCancel, onEditValueChange, onAddCategory, onRenameCategory, onRemoveCategory }) {
  const [catEditId, setCatEditId] = useState(null);
  const [catEditValue, setCatEditValue] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);

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

  const handleCatRename = async (catId) => {
    if (!catEditValue.trim()) return;
    setCatSaving(true);
    await onRenameCategory(catId, catEditValue.trim());
    setCatEditId(null);
    setCatSaving(false);
  };

  const handleAddCat = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    await onAddCategory(newCatName.trim());
    setNewCatName('');
    setShowAddCat(false);
    setCatSaving(false);
  };

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
        <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>Categories</p>
          <button className="bk-btn bk-btn--sm" onClick={() => { setShowAddCat(v => !v); setNewCatName(''); }}>
            {showAddCat ? 'Cancel' : '+ Add category'}
          </button>
        </div>

        {event.categories.map(cat => (
          <div key={cat.id} style={{ fontSize: '0.875rem', marginBottom: '0.4rem' }}>
            {catEditId === cat.id ? (
              <div className="bk-row" style={{ gap: '0.5rem' }}>
                <input
                  className="bk-input"
                  style={{ maxWidth: 260 }}
                  value={catEditValue}
                  onChange={e => setCatEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCatRename(cat.id); if (e.key === 'Escape') setCatEditId(null); }}
                />
                <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={catSaving} onClick={() => handleCatRename(cat.id)}>Save</button>
                <button className="bk-btn bk-btn--sm" onClick={() => setCatEditId(null)}>Cancel</button>
              </div>
            ) : (
              <div className="bk-row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <span
                  style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                  title="Click to rename"
                  onClick={() => { setCatEditId(cat.id); setCatEditValue(cat.name); }}
                >
                  {cat.name}
                </span>
                {cat.skillCompetitions?.length > 0 && (
                  <span className="bk-muted" style={{ fontSize: '0.8rem' }}>
                    ({cat.skillCompetitions.length} skill level{cat.skillCompetitions.length !== 1 ? 's' : ''} linked)
                  </span>
                )}
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ color: 'var(--booking-danger)', fontSize: '0.8rem', marginLeft: '0.25rem' }}
                  onClick={() => onRemoveCategory(cat.id)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}

        {event.categories.length === 0 && !showAddCat && (
          <p className="bk-muted" style={{ fontSize: '0.875rem' }}>No categories yet.</p>
        )}

        {showAddCat && (
          <div className="bk-row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              className="bk-input"
              style={{ maxWidth: 260 }}
              placeholder="Category name e.g. Women's 13-14"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddCat(); if (e.key === 'Escape') setShowAddCat(false); }}
            />
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={catSaving || !newCatName.trim()} onClick={handleAddCat}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InvitesTab({ eligible, eligibleError, allGymnasts, inviting, onInvite, onUninvite, eventEntries, eventCategories }) {
  const [showAll, setShowAll] = useState(false);
  const [pendingGym, setPendingGym] = useState(null); // { id, firstName, lastName }
  const [pendingCatIds, setPendingCatIds] = useState([]);
  const [pendingPrice, setPendingPrice] = useState('');

  if (eligibleError) return <p style={{ color: 'var(--booking-danger)', fontSize: '0.875rem' }}>{eligibleError}</p>;
  if (eligible === null) return <p className="bk-muted">Loading...</p>;

  const entryMap = Object.fromEntries((eventEntries || []).map(e => [e.gymnast.id, e.id]));
  const notInvited = (allGymnasts || []).filter(g => !g.alreadyInvited);

  const startInvite = (g, preSelectCatId = null) => {
    setPendingGym(g);
    setPendingCatIds(preSelectCatId ? [preSelectCatId] : []);
    setPendingPrice('');
  };

  const cancelInvite = () => {
    setPendingGym(null);
    setPendingCatIds([]);
    setPendingPrice('');
  };

  const confirmInvite = async () => {
    const priceOverride = pendingPrice !== '' ? Math.round(parseFloat(pendingPrice) * 100) : null;
    await onInvite(pendingGym.id, pendingCatIds, priceOverride);
    cancelInvite();
  };

  const toggleCat = (catId) =>
    setPendingCatIds(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);

  const renderGymnastRow = (g, preSelectCatId = null) => {
    const isPending = pendingGym?.id === g.id;
    return (
      <React.Fragment key={g.id}>
        <tr>
          <td>{g.firstName} {g.lastName}</td>
          <td>
            {g.alreadyInvited ? (
              <div className="bk-row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--booking-success)', fontSize: '0.85rem', fontWeight: 600 }}>Invited</span>
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ color: 'var(--booking-danger)', fontSize: '0.8rem' }}
                  onClick={() => onUninvite(entryMap[g.id], g.id)}
                >
                  Remove
                </button>
              </div>
            ) : isPending ? (
              <button className="bk-btn bk-btn--sm" onClick={cancelInvite}>Cancel</button>
            ) : (
              <button
                className="bk-btn bk-btn--sm bk-btn--primary"
                disabled={inviting}
                onClick={() => startInvite(g, preSelectCatId)}
              >
                Invite
              </button>
            )}
          </td>
        </tr>
        {isPending && (
          <tr>
            <td colSpan={2} style={{ paddingTop: 0 }}>
              <div style={{ background: 'var(--booking-bg, #f9fafb)', border: '1px solid var(--booking-border)', borderRadius: 6, padding: '0.75rem', marginTop: '0.35rem' }}>
                {eventCategories.length > 0 && (
                  <div style={{ marginBottom: '0.6rem' }}>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: 600 }}>Categories:</p>
                    {eventCategories.map(cat => (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.2rem' }}>
                        <input type="checkbox" checked={pendingCatIds.includes(cat.id)} onChange={() => toggleCat(cat.id)} />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                )}
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Price override (£) — leave blank to use standard pricing
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="bk-input"
                  style={{ maxWidth: 120, marginBottom: '0.6rem' }}
                  value={pendingPrice}
                  placeholder="e.g. 15.00"
                  onChange={e => setPendingPrice(e.target.value)}
                />
                <div className="bk-row" style={{ gap: '0.5rem' }}>
                  <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={inviting} onClick={confirmInvite}>
                    {inviting ? 'Inviting...' : 'Confirm invite'}
                  </button>
                  <button className="bk-btn bk-btn--sm" onClick={cancelInvite}>Cancel</button>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div>
      {eligible.length > 0 && (
        <>
          <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Gymnasts below have completed the linked skill tracker levels for each category.
          </p>
          {eligible.map(cat => {
            const noFilter = allGymnasts && cat.gymnasts.length === allGymnasts.length;
            return (
              <div key={cat.categoryId} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>{cat.categoryName}</h4>
                {noFilter && (
                  <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                    No skill level filter set — showing all gymnasts.
                  </p>
                )}
                {cat.gymnasts.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem' }}>No eligible gymnasts found.</p>}
                {cat.gymnasts.length > 0 && (
                  <table className="bk-table">
                    <tbody>
                      {cat.gymnasts.map(g => renderGymnastRow(g, cat.categoryId))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </>
      )}

      <div style={{ marginTop: eligible.length > 0 ? '1.5rem' : 0, borderTop: eligible.length > 0 ? '1px solid var(--booking-border)' : 'none', paddingTop: eligible.length > 0 ? '1rem' : 0 }}>
        <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.875rem' }} onClick={() => setShowAll(v => !v)}>
          {showAll ? 'Hide' : '+ Add any gymnast'}
        </button>
        {showAll && (
          <div style={{ marginTop: '0.75rem' }}>
            {notInvited.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem' }}>All gymnasts have already been invited.</p>}
            {notInvited.length > 0 && (
              <table className="bk-table">
                <tbody>
                  {notInvited.map(g => renderGymnastRow(g, null))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline expand panel shared by multiple actions
function ActionPanel({ title, onConfirm, onClose, working, confirmLabel, children }) {
  return (
    <div style={{ background: 'var(--booking-surface,#fff)', border: '1px solid var(--booking-border)', borderRadius: 8, padding: '0.75rem', marginTop: '0.5rem' }}>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>{title}</p>
      {children}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={working} onClick={onConfirm}>
          {working ? 'Saving…' : confirmLabel}
        </button>
        <button className="bk-btn bk-btn--sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function EntryActions({ entry, onConfirmInvoice, onResendInvoice, onWaive, onMarkPaid }) {
  const [expanded, setExpanded] = useState(null); // 'confirm' | 'waive' | 'paid'
  const [priceOverride, setPriceOverride] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [working, setWorking] = useState(false);

  const close = () => { setExpanded(null); setPriceOverride(''); setWaiveReason(''); setPaidAmount(''); setPaidNote(''); };

  const doConfirm = async () => {
    setWorking(true);
    const override = priceOverride !== '' ? Math.round(parseFloat(priceOverride) * 100) : undefined;
    await onConfirmInvoice(entry.id, override);
    setWorking(false);
    close();
  };

  const doWaive = async () => {
    setWorking(true);
    await onWaive(entry.id, waiveReason);
    setWorking(false);
    close();
  };

  const doMarkPaid = async () => {
    setWorking(true);
    const amount = paidAmount !== '' ? Math.round(parseFloat(paidAmount) * 100) : undefined;
    await onMarkPaid(entry.id, amount, paidNote);
    setWorking(false);
    close();
  };

  if (entry.status === 'ACCEPTED') {
    return (
      <div>
        {expanded ? (
          <>
            {expanded === 'confirm' && (
              <ActionPanel title="Confirm & send invoice" confirmLabel="Send invoice" working={working} onConfirm={doConfirm} onClose={close}>
                <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.3rem', color: 'var(--booking-text-muted)' }}>
                  Price override (£) — leave blank for standard pricing
                </label>
                <input type="number" step="0.01" min="0" className="bk-input" style={{ marginBottom: '0.25rem' }}
                  placeholder="e.g. 15.00" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} />
              </ActionPanel>
            )}
            {expanded === 'waive' && (
              <ActionPanel title="Waive payment" confirmLabel="Confirm waive" working={working} onConfirm={doWaive} onClose={close}>
                <input className="bk-input" placeholder="Reason (optional, e.g. judging duties)"
                  value={waiveReason} onChange={e => setWaiveReason(e.target.value)} />
              </ActionPanel>
            )}
            {expanded === 'paid' && (
              <ActionPanel title="Record external payment" confirmLabel="Mark paid" working={working} onConfirm={doMarkPaid} onClose={close}>
                <input type="number" step="0.01" min="0" className="bk-input" style={{ marginBottom: '0.4rem' }}
                  placeholder="Amount (£)" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
                <input className="bk-input" placeholder="Note (optional)"
                  value={paidNote} onChange={e => setPaidNote(e.target.value)} />
              </ActionPanel>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setExpanded('confirm')}>
              Confirm &amp; send invoice
            </button>
            <button className="bk-btn bk-btn--sm" onClick={() => setExpanded('waive')}>Waive</button>
            <button className="bk-btn bk-btn--sm" onClick={() => setExpanded('paid')}>Record payment</button>
          </div>
        )}
      </div>
    );
  }

  if (entry.status === 'PAYMENT_PENDING') {
    return (
      <div>
        {expanded === 'waive' && (
          <ActionPanel title="Waive payment" confirmLabel="Confirm waive" working={working} onConfirm={doWaive} onClose={close}>
            <input className="bk-input" placeholder="Reason (optional)"
              value={waiveReason} onChange={e => setWaiveReason(e.target.value)} />
          </ActionPanel>
        )}
        {expanded === 'paid' && (
          <ActionPanel title="Record external payment" confirmLabel="Mark paid" working={working} onConfirm={doMarkPaid} onClose={close}>
            <input type="number" step="0.01" min="0" className="bk-input" style={{ marginBottom: '0.4rem' }}
              placeholder="Amount (£)" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            <input className="bk-input" placeholder="Note (optional)"
              value={paidNote} onChange={e => setPaidNote(e.target.value)} />
          </ActionPanel>
        )}
        {!expanded && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button className="bk-btn bk-btn--sm" disabled={working}
              onClick={async () => { setWorking(true); await onResendInvoice(entry.id); setWorking(false); }}>
              {working ? 'Sending…' : 'Re-send invoice'}
            </button>
            <button className="bk-btn bk-btn--sm" onClick={() => setExpanded('paid')}>Record payment</button>
            <button className="bk-btn bk-btn--sm" onClick={() => setExpanded('waive')}>Waive</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function EntriesTab({ event, entryCountByStatus, onRemove, onConfirmInvoice, onResendInvoice, onWaive, onMarkPaid, onToggleSubmitted }) {
  const ORDER = { ACCEPTED: 0, PAYMENT_PENDING: 1, INVITED: 2, PAID: 3, WAIVED: 4, DECLINED: 5 };
  const sorted = [...event.entries].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div>
      {Object.keys(entryCountByStatus).length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
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

      {sorted.length === 0 && <p className="bk-muted">No entries yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sorted.map(entry => {
          const s = STATUS_LABELS[entry.status] || { label: entry.status, color: 'inherit' };
          const ageEoy = entry.gymnast.dateOfBirth
            ? new Date().getFullYear() - new Date(entry.gymnast.dateOfBirth).getFullYear()
            : null;
          const isDone = ['PAID', 'WAIVED'].includes(entry.status);
          return (
            <div key={entry.id} className="bk-card" style={{
              borderLeft: `3px solid ${s.color}`,
              padding: '0.85rem 1rem',
              background: entry.status === 'ACCEPTED' ? 'rgba(124,53,232,0.03)' : undefined,
            }}>
              {/* Top row: name + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {entry.gymnast.firstName} {entry.gymnast.lastName}
                  </span>
                  {(ageEoy || entry.gymnast.bgNumber) && (
                    <span className="bk-muted" style={{ fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                      {ageEoy ? `age ${ageEoy}` : ''}
                      {ageEoy && entry.gymnast.bgNumber ? ' · ' : ''}
                      {entry.gymnast.bgNumber || ''}
                    </span>
                  )}
                </div>
                <span style={{ color: s.color, fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>

              {/* Categories */}
              {entry.categories.length > 0 && (
                <p className="bk-muted" style={{ fontSize: '0.82rem', margin: '0 0 0.35rem' }}>
                  {entry.categories.map(ec => ec.category.name).join(', ')}
                </p>
              )}

              {/* Amount + invoice date / waive reason */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                {entry.status === 'WAIVED' ? (
                  <span style={{ fontSize: '0.82rem', color: 'var(--booking-success)', fontWeight: 600 }}>Free entry</span>
                ) : entry.totalAmount !== null ? (
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    £{(entry.totalAmount / 100).toFixed(2)}
                    {entry.paidExternally && (
                      <span className="bk-muted" style={{ fontWeight: 400, marginLeft: '0.25rem' }}>
                        (external{entry.externalPaymentNote ? ` — ${entry.externalPaymentNote}` : ''})
                      </span>
                    )}
                  </span>
                ) : null}
                {entry.invoiceSentAt && (
                  <span className="bk-muted" style={{ fontSize: '0.78rem' }}>
                    Invoice sent {new Date(entry.invoiceSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {entry.waivedReason && (
                  <span className="bk-muted" style={{ fontSize: '0.78rem' }}>{entry.waivedReason}</span>
                )}
              </div>

              {/* Actions */}
              <EntryActions
                entry={entry}
                onConfirmInvoice={onConfirmInvoice}
                onResendInvoice={onResendInvoice}
                onWaive={onWaive}
                onMarkPaid={onMarkPaid}
              />

              {/* Bottom row: submitted toggle + remove */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid var(--booking-border)' }}>
                {isDone ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={entry.submittedToOrganiser}
                      onChange={() => onToggleSubmitted(entry.id, entry.submittedToOrganiser)}
                    />
                    {entry.submittedToOrganiser ? 'Submitted to organiser' : 'Mark as submitted to organiser'}
                  </label>
                ) : (
                  <span />
                )}
                {!isDone && (
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ color: 'var(--booking-danger)', fontSize: '0.8rem' }}
                    onClick={() => onRemove(entry.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
