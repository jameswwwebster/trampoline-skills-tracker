import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import Toast from '../../../components/Toast';
import useToast from '../../../hooks/useToast';
import '../booking-shared.css';

const STATUS_LABELS = {
  INVITED: { label: 'Invited', color: '#1565c0' },
  ACCEPTED: { label: 'Accepted — awaiting review', color: '#7c35e8' },
  PAYMENT_PENDING: { label: 'Awaiting payment', color: 'var(--booking-warning, #e67e22)' },
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

  const handleAddCategory = async (name, skillCompetitionIds = []) => {
    try {
      await bookingApi.addCompetitionCategory(id, { name, skillCompetitionIds });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to add category.');
    }
  };

  const handleRenameCategory = async (catId, name, skillCompetitionIds) => {
    try {
      await bookingApi.updateCompetitionCategory(id, catId, { name, skillCompetitionIds });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to update category.');
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
      await bookingApi.sendCompetitionReminder(entryId);
      setMsg('Reminder sent.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to send reminder.');
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

  const handleInviteSynchro = async (gymnastIds, categoryIds, priceOverride) => {
    setInviting(true);
    try {
      await bookingApi.inviteGymnasts(id, gymnastIds, categoryIds, priceOverride, 'SYNCHRO');
      const [, allRes] = await Promise.all([load(), bookingApi.getAllCompetitionGymnasts(id)]);
      setAllGymnasts(allRes.data);
      setMsg('Synchro pair invited. Entries are visible in the Entries tab.');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to invite synchro pair.';
      setMsg(message);
      throw new Error(message); // let InvitesTab know so it doesn't close the form
    } finally {
      setInviting(false);
    }
  };

  const handleReinvite = async (entryId) => {
    if (!window.confirm('Re-invite this gymnast? This will reset the entry to INVITED and send them a new invite email.')) return;
    try {
      await bookingApi.reinviteCompetitionEntry(entryId);
      await load();
      setMsg('Re-invite sent.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to re-invite.');
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
          onInviteSynchro={handleInviteSynchro}
          eventEntries={event.entries}
          eventCategories={event.categories}
          priceTiers={event.priceTiers}
          lateEntryFee={event.lateEntryFee}
          entryDeadline={event.entryDeadline}
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
          onReinvite={handleReinvite}
        />
      )}
    </div>
  );
}

function DetailsTab({ event, editField, editValue, saving, onEdit, onSave, onCancel, onEditValueChange, onAddCategory, onRenameCategory, onRemoveCategory }) {
  const [catEditId, setCatEditId] = useState(null);
  const [catEditValue, setCatEditValue] = useState('');
  const [catEditSkillIds, setCatEditSkillIds] = useState([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSkillIds, setNewCatSkillIds] = useState([]);
  const [skillCompetitions, setSkillCompetitions] = useState([]);
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    bookingApi.getSkillCompetitions()
      .then(res => {
        const data = res.data;
        setSkillCompetitions(Array.isArray(data) ? data : data.competitions || []);
      })
      .catch(() => {});
  }, []);

  const fields = [
    { key: 'name', label: 'Name', type: 'text', display: event.name },
    { key: 'location', label: 'Location', type: 'text', display: event.location },
    { key: 'description', label: 'Description', type: 'textarea', display: event.description || '—', editVal: event.description || '' },
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
    await onRenameCategory(catId, catEditValue.trim(), catEditSkillIds);
    setCatEditId(null);
    setCatSaving(false);
  };

  const toggleCatEditSkill = (scId) =>
    setCatEditSkillIds(prev => prev.includes(scId) ? prev.filter(id => id !== scId) : [...prev, scId]);

  const handleAddCat = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    await onAddCategory(newCatName.trim(), newCatSkillIds);
    setNewCatName('');
    setNewCatSkillIds([]);
    setShowAddCat(false);
    setCatSaving(false);
  };

  const toggleNewCatSkill = (scId) =>
    setNewCatSkillIds(prev => prev.includes(scId) ? prev.filter(id => id !== scId) : [...prev, scId]);

  return (
    <div>
      <table className="bk-table" style={{ maxWidth: 600, marginBottom: '1.5rem' }}>
        <tbody>
          {fields.map(f => (
            <tr key={f.key}>
              <td style={{ fontWeight: 500, width: '160px' }}>{f.label}</td>
              <td>
                {editField === f.key ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 400 }}>
                    {f.type === 'textarea' ? (
                      <textarea
                        className="bk-input"
                        rows={4}
                        style={{ resize: 'vertical' }}
                        value={editValue}
                        onChange={e => onEditValueChange(e.target.value)}
                        autoFocus
                      />
                    ) : (
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
                    )}
                    <div className="bk-row" style={{ gap: '0.5rem' }}>
                      <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving} onClick={() => onSave(f.key, editValue)}>Save</button>
                      <button className="bk-btn bk-btn--sm" onClick={onCancel}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <span
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted', whiteSpace: 'pre-wrap' }}
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
              <div style={{ border: '1px solid var(--booking-border)', borderRadius: 6, padding: '0.75rem', background: 'var(--booking-bg,#f9fafb)' }}>
                <input
                  className="bk-input"
                  style={{ marginBottom: '0.6rem' }}
                  value={catEditValue}
                  onChange={e => setCatEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Escape') setCatEditId(null); }}
                />
                {skillCompetitions.filter(sc => sc.isActive).length > 0 && (
                  <div style={{ marginBottom: '0.6rem' }}>
                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>
                      Linked skill levels <span className="bk-muted" style={{ fontWeight: 400 }}>(optional)</span>
                    </p>
                    {skillCompetitions.filter(sc => sc.isActive).map(sc => (
                      <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.2rem' }}>
                        <input
                          type="checkbox"
                          checked={catEditSkillIds.includes(sc.id)}
                          onChange={() => toggleCatEditSkill(sc.id)}
                        />
                        {sc.name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="bk-row" style={{ gap: '0.5rem' }}>
                  <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={catSaving || !catEditValue.trim()} onClick={() => handleCatRename(cat.id)}>Save</button>
                  <button className="bk-btn bk-btn--sm" onClick={() => setCatEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="bk-row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <span
                  style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                  title="Click to edit"
                  onClick={() => {
                    setCatEditId(cat.id);
                    setCatEditValue(cat.name);
                    setCatEditSkillIds((cat.skillCompetitions || []).map(sc => sc.skillCompetitionId || sc.id));
                  }}
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
          <div style={{ marginTop: '0.5rem', border: '1px solid var(--booking-border)', borderRadius: 6, padding: '0.75rem', background: 'var(--booking-bg,#f9fafb)' }}>
            <input
              className="bk-input"
              style={{ marginBottom: '0.6rem' }}
              placeholder="Category name e.g. Women's 13-14"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddCat(); if (e.key === 'Escape') setShowAddCat(false); }}
            />
            {skillCompetitions.filter(sc => sc.isActive).length > 0 && (
              <div style={{ marginBottom: '0.6rem' }}>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  Linked skill levels <span className="bk-muted" style={{ fontWeight: 400 }}>(optional — used to auto-suggest eligible gymnasts)</span>
                </p>
                {skillCompetitions.filter(sc => sc.isActive).map(sc => (
                  <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.2rem' }}>
                    <input
                      type="checkbox"
                      checked={newCatSkillIds.includes(sc.id)}
                      onChange={() => toggleNewCatSkill(sc.id)}
                    />
                    {sc.name}
                  </label>
                ))}
              </div>
            )}
            <div className="bk-row" style={{ gap: '0.5rem' }}>
              <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={catSaving || !newCatName.trim()} onClick={handleAddCat}>Add category</button>
              <button className="bk-btn bk-btn--sm" onClick={() => { setShowAddCat(false); setNewCatName(''); setNewCatSkillIds([]); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvitesTab({ eligible, eligibleError, allGymnasts, inviting, onInvite, onUninvite, onInviteSynchro, eventEntries, eventCategories, priceTiers, lateEntryFee, entryDeadline }) {
  const [showAll, setShowAll] = useState(false);
  const [pendingGym, setPendingGym] = useState(null); // { id, firstName, lastName }
  const [pendingCatIds, setPendingCatIds] = useState([]);
  const [pendingPrice, setPendingPrice] = useState('');
  const [showSynchro, setShowSynchro] = useState(false);
  const [synchroGym1, setSynchroGym1] = useState('');
  const [synchroGym2, setSynchroGym2] = useState('');
  const [synchroCatIds, setSynchroCatIds] = useState([]);
  const [synchroPrice, setSynchroPrice] = useState('');
  const [synchroWorking, setSynchroWorking] = useState(false);
  const { toast: synchroToast, showToast: showSynchroToast, dismissToast: dismissSynchroToast } = useToast();

  const calcSuggestedPrice = (numCats) => {
    if (numCats === 0 || !priceTiers || priceTiers.length === 0) return null;
    const sorted = [...priceTiers].sort((a, b) => a.entryNumber - b.entryNumber);
    const tierIndex = Math.min(numCats - 1, sorted.length - 1);
    let total = sorted[tierIndex].price;
    const isLate = entryDeadline && new Date() > new Date(entryDeadline);
    if (isLate && lateEntryFee) total += lateEntryFee;
    return total;
  };

  if (eligibleError) return <p style={{ color: 'var(--booking-danger)', fontSize: '0.875rem' }}>{eligibleError}</p>;
  if (eligible === null) return <p className="bk-muted">Loading...</p>;

  const entryMap = Object.fromEntries((eventEntries || []).map(e => [e.gymnast?.id, e.id]));
  const notInvited = (allGymnasts || []).filter(g => !g.alreadyInvited);

  const handleSynchroInvite = async () => {
    if (!synchroGym1 || !synchroGym2 || synchroGym1 === synchroGym2) return;
    setSynchroWorking(true);
    try {
      const priceOverride = synchroPrice !== '' ? Math.round(parseFloat(synchroPrice) * 100) : null;
      await onInviteSynchro([synchroGym1, synchroGym2], synchroCatIds, priceOverride);
      setShowSynchro(false);
      setSynchroGym1(''); setSynchroGym2(''); setSynchroCatIds([]); setSynchroPrice('');
    } catch (err) {
      showSynchroToast(err.response?.data?.error || 'Failed to invite synchro pair.', 'error');
    } finally {
      setSynchroWorking(false);
    }
  };

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
    if (pendingCatIds.length === 0) return;
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
                {pendingCatIds.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--booking-danger)', margin: '0 0 0.4rem' }}>
                    Select at least one category before sending.
                  </p>
                )}
                {(() => {
                  const suggested = calcSuggestedPrice(pendingCatIds.length);
                  const suggestedStr = suggested !== null ? `£${(suggested / 100).toFixed(2)}` : null;
                  return (
                    <>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Price (£){suggestedStr ? ` — suggested: ${suggestedStr}` : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="bk-input"
                        style={{ maxWidth: 120, marginBottom: '0.6rem' }}
                        value={pendingPrice}
                        placeholder={suggestedStr ? suggestedStr.replace('£', '') : 'e.g. 15.00'}
                        onChange={e => setPendingPrice(e.target.value)}
                      />
                    </>
                  );
                })()}
                <div className="bk-row" style={{ gap: '0.5rem' }}>
                  <button
                    className="bk-btn bk-btn--sm bk-btn--primary"
                    disabled={inviting || pendingCatIds.length === 0}
                    onClick={confirmInvite}
                  >
                    {inviting ? 'Inviting...' : 'Send invite'}
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

      {/* Synchro pair invites */}
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--booking-border)', paddingTop: '1rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Synchro pairs</p>
        {(() => {
          // Group SYNCHRO entries by synchroPairId
          const synchroEntries = (eventEntries || []).filter(e => e.entryType === 'SYNCHRO' && e.synchroPairId);
          const pairs = {};
          for (const e of synchroEntries) {
            if (!pairs[e.synchroPairId]) pairs[e.synchroPairId] = [];
            pairs[e.synchroPairId].push(e);
          }
          const pairList = Object.values(pairs);
          if (pairList.length === 0) {
            return <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>No synchro pairs yet.</p>;
          }
          return (
            <div style={{ marginBottom: '0.75rem' }}>
              {pairList.map((pair, i) => (
                <div key={i} style={{ fontSize: '0.875rem', padding: '0.4rem 0.6rem', background: 'var(--booking-bg,#f9fafb)', border: '1px solid var(--booking-border)', borderRadius: 4, marginBottom: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>
                    {pair.map(e => `${e.gymnast.firstName} ${e.gymnast.lastName}`).join(' & ')}
                  </span>
                  <span className="bk-muted" style={{ fontSize: '0.8rem' }}>
                    — {STATUS_LABELS[pair[0]?.status]?.label || pair[0]?.status}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
        <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.875rem' }} onClick={() => setShowSynchro(v => !v)}>
          {showSynchro ? 'Hide' : '+ Add synchro pair'}
        </button>
        {showSynchro && (
          <div style={{ marginTop: '0.75rem', background: 'var(--booking-bg,#f9fafb)', border: '1px solid var(--booking-border)', borderRadius: 6, padding: '0.85rem' }}>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>Invite a synchro pair</p>
            <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.6rem' }}>
              Each gymnast gets their own entry and invoice. Select two different gymnasts.
            </p>
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Gymnast 1</label>
                <select className="bk-input" value={synchroGym1} onChange={e => setSynchroGym1(e.target.value)}>
                  <option value="">Select gymnast…</option>
                  {(allGymnasts || []).map(g => (
                    <option key={g.id} value={g.id} disabled={g.id === synchroGym2}>
                      {g.firstName} {g.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Gymnast 2</label>
                <select className="bk-input" value={synchroGym2} onChange={e => setSynchroGym2(e.target.value)}>
                  <option value="">Select gymnast…</option>
                  {(allGymnasts || []).map(g => (
                    <option key={g.id} value={g.id} disabled={g.id === synchroGym1}>
                      {g.firstName} {g.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {eventCategories.length > 0 && (
              <div style={{ marginBottom: '0.6rem' }}>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>Categories (applied to both):</p>
                {eventCategories.map(cat => (
                  <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.2rem' }}>
                    <input
                      type="checkbox"
                      checked={synchroCatIds.includes(cat.id)}
                      onChange={() => setSynchroCatIds(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])}
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            )}
            {synchroCatIds.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--booking-danger)', margin: '0 0 0.4rem' }}>
                Select at least one category before sending.
              </p>
            )}
            {(() => {
              const suggested = calcSuggestedPrice(synchroCatIds.length);
              const suggestedStr = suggested !== null ? `£${(suggested / 100).toFixed(2)}` : null;
              return (
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Price per gymnast (£){suggestedStr ? ` — suggested: ${suggestedStr}` : ''}
                </label>
              );
            })()}
            <input
              type="number"
              step="0.01"
              min="0"
              className="bk-input"
              style={{ maxWidth: 120, marginBottom: '0.6rem' }}
              value={synchroPrice}
              placeholder="e.g. 15.00"
              onChange={e => setSynchroPrice(e.target.value)}
            />
            <div className="bk-row" style={{ gap: '0.5rem' }}>
              <button
                className="bk-btn bk-btn--sm bk-btn--primary"
                disabled={synchroWorking || !synchroGym1 || !synchroGym2 || synchroGym1 === synchroGym2 || synchroCatIds.length === 0}
                onClick={handleSynchroInvite}
              >
                {synchroWorking ? 'Inviting…' : 'Invite pair'}
              </button>
              <button className="bk-btn bk-btn--sm" onClick={() => { setShowSynchro(false); setSynchroGym1(''); setSynchroGym2(''); setSynchroCatIds([]); setSynchroPrice(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {synchroToast && <Toast message={synchroToast.message} type={synchroToast.type} onDismiss={dismissSynchroToast} />}
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

function EntryActions({ entry, onConfirmInvoice, onResendInvoice, onWaive, onMarkPaid, onReinvite }) {
  const [expanded, setExpanded] = useState(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [working, setWorking] = useState(false);

  const close = () => { setExpanded(null); setWaiveReason(''); setPaidAmount(''); setPaidNote(''); };

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
              {working ? 'Sending…' : 'Send reminder'}
            </button>
            <button className="bk-btn bk-btn--sm" onClick={() => setExpanded('paid')}>Record payment</button>
            <button className="bk-btn bk-btn--sm" onClick={() => setExpanded('waive')}>Waive</button>
            <button className="bk-btn bk-btn--sm" onClick={() => onReinvite(entry.id)}>Re-invite</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function EntriesTab({ event, entryCountByStatus, onRemove, onConfirmInvoice, onResendInvoice, onWaive, onMarkPaid, onToggleSubmitted, onReinvite }) {
  const ORDER = { PAYMENT_PENDING: 0, INVITED: 1, PAID: 2, WAIVED: 3, DECLINED: 4 };
  const sorted = [...event.entries].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  // Build a map from synchroPairId → list of gymnast names (for displaying synchro partners)
  const synchroPairMap = {};
  for (const e of event.entries) {
    if (e.synchroPairId) {
      if (!synchroPairMap[e.synchroPairId]) synchroPairMap[e.synchroPairId] = [];
      synchroPairMap[e.synchroPairId].push(e);
    }
  }

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
          const isSynchro = entry.entryType === 'SYNCHRO';
          const synchroPartner = isSynchro && entry.synchroPairId
            ? (synchroPairMap[entry.synchroPairId] || []).find(e => e.id !== entry.id)
            : null;
          return (
            <div key={entry.id} className="bk-card" style={{
              borderLeft: `3px solid ${s.color}`,
              padding: '0.85rem 1rem',
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
                  {isSynchro && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#e8f4fd', color: '#1565c0', borderRadius: 4, padding: '1px 6px', marginLeft: '0.5rem' }}>
                      Synchro
                    </span>
                  )}
                </div>
                <span style={{ color: s.color, fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>

              {/* Synchro partner */}
              {synchroPartner && (
                <p className="bk-muted" style={{ fontSize: '0.82rem', margin: '0 0 0.25rem' }}>
                  Partner: {synchroPartner.gymnast.firstName} {synchroPartner.gymnast.lastName}
                </p>
              )}

              {/* Categories */}
              {entry.categories.length > 0 && (
                <p className="bk-muted" style={{ fontSize: '0.82rem', margin: '0 0 0.35rem' }}>
                  {entry.categories.map(ec => ec.category.name).join(', ')}
                </p>
              )}

              {/* Previous paid amount (shown on re-invited entries) */}
              {entry.previousPaidAmount !== null && entry.previousPaidAmount !== undefined && (
                <p style={{ fontSize: '0.78rem', color: 'var(--booking-warning, #e67e22)', margin: '0 0 0.35rem' }}>
                  Note: previously paid £{(entry.previousPaidAmount / 100).toFixed(2)} for this competition
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
                onReinvite={onReinvite}
              />

              {/* Bottom row: submitted toggle + remove/re-invite */}
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
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {entry.status === 'DECLINED' && (
                    <button
                      className="bk-btn bk-btn--sm bk-btn--primary"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => onReinvite(entry.id)}
                    >
                      Re-invite
                    </button>
                  )}
                  {!isDone && entry.status !== 'DECLINED' && (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
