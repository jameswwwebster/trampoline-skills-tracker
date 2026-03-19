import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { bookingApi, getTemplates, createTemplate, updateTemplate, toggleTemplate, deleteTemplate } from '../../../utils/bookingApi';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', competitiveSlots: '', pricePerGymnast: '6', information: '', type: 'TRAMPOLINE', startDate: '' };

// Minimal TipTap toolbar
function Toolbar({ editor }) {
  if (!editor) return null;
  const btn = (label, action, active) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); action(); }}
      style={{
        padding: '0.25rem 0.5rem',
        background: active ? 'var(--booking-accent)' : 'var(--booking-bg-light)',
        color: active ? '#fff' : 'var(--booking-text-on-light)',
        border: '1px solid var(--booking-border)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >{label}</button>
  );
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', padding: '0.4rem', borderBottom: '1px solid var(--booking-border)', background: 'var(--booking-bg-light)' }}>
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {btn('• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {btn('Link', () => {
        const url = window.prompt('URL');
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }, editor.isActive('link'))}
      {editor.isActive('link') && btn('Unlink', () => editor.chain().focus().unsetLink().run(), false)}
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. when form is reset)
  useEffect(() => {
    if (editor && value === '') {
      editor.commands.clearContent();
    }
  }, [editor, value]);

  return (
    <div
      style={{ border: '1.5px solid var(--booking-border)', borderRadius: 'var(--booking-radius)', overflow: 'hidden' }}
      onClick={() => editor?.commands.focus()}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        style={{ minHeight: '120px', padding: '0.6rem 0.75rem', fontSize: '0.9rem', cursor: 'text' }}
      />
    </div>
  );
}

// Modal for confirming future instance changes
function ConfirmModal({ message, onYes, onNo, onCancel, yesLabel = 'Yes', noLabel = 'No', cancelLabel = 'Cancel' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ background: 'var(--booking-bg-white)', borderRadius: 'var(--booking-radius-lg)', padding: '1.5rem', maxWidth: '420px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--booking-text-on-light)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onCancel && <button className="bk-btn bk-btn--ghost" onClick={onCancel}>{cancelLabel}</button>}
          {onNo && <button className="bk-btn bk-btn--ghost" onClick={onNo}>{noLabel}</button>}
          <button className="bk-btn bk-btn--primary" onClick={onYes}>{yesLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function SessionTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = create form
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // { type, templateId, payload }
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [openPanels, setOpenPanels] = useState({});
  const [panelData, setPanelData] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getTemplates();
      setTemplates(data);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadPanel = useCallback(async (templateId) => {
    setPanelData(prev => ({ ...prev, [templateId]: { ...(prev[templateId] || {}), loading: true, error: null } }));
    try {
      const { data } = await bookingApi.getCommitmentsForTemplate(templateId);
      setPanelData(prev => ({ ...prev, [templateId]: { commitments: data, loading: false, error: null } }));
    } catch {
      setPanelData(prev => ({ ...prev, [templateId]: { commitments: [], loading: false, error: 'Failed to load' } }));
    }
  }, []);

  const togglePanel = (templateId) => {
    const isOpening = !openPanels[templateId];
    setOpenPanels(prev => ({ ...prev, [templateId]: isOpening }));
    if (isOpening) loadPanel(templateId);
  };

  const handlePauseCommitment = async (templateId, commitmentId) => {
    try {
      await bookingApi.updateCommitmentStatus(commitmentId, 'PAUSED');
      loadPanel(templateId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to pause commitment');
    }
  };

  const handleActivateCommitment = async (templateId, commitmentId) => {
    try {
      await bookingApi.updateCommitmentStatus(commitmentId, 'ACTIVE');
      loadPanel(templateId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to activate commitment');
    }
  };

  const handleRemoveCommitment = async (templateId, commitmentId) => {
    if (!window.confirm('Remove this commitment?')) return;
    try {
      await bookingApi.deleteCommitment(commitmentId);
      loadPanel(templateId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove commitment');
    }
  };

  const openCreate = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({
      dayOfWeek: String(t.dayOfWeek),
      startTime: t.startTime,
      endTime: t.endTime,
      openSlots: String(t.openSlots),
      minAge: t.minAge != null ? String(t.minAge) : '',
      competitiveSlots: t.competitiveSlots != null ? String(t.competitiveSlots) : '',
      pricePerGymnast: String(t.pricePerGymnast / 100),
      information: t.information || '',
      type: t.type,
      startDate: t.startDate ? t.startDate.split('T')[0] : '',
    });
  };

  const closeForm = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const buildPayload = () => ({
    dayOfWeek: parseInt(form.dayOfWeek),
    startTime: form.startTime,
    endTime: form.endTime,
    openSlots: parseInt(form.openSlots),
    pricePerGymnast: Math.round(parseFloat(form.pricePerGymnast) * 100) || 600,
    minAge: form.minAge !== '' ? parseInt(form.minAge) : null,
    competitiveSlots: form.competitiveSlots !== '' ? parseInt(form.competitiveSlots) : null,
    information: form.information || null,
    type: form.type,
    startDate: form.startDate || null,
  });

  const handleSave = async (applyToFutureInstances) => {
    setSaving(true);
    setModal(null);
    setError(null);
    try {
      if (editingId === 'new') {
        await createTemplate(buildPayload());
      } else {
        await updateTemplate(editingId, { ...buildPayload(), applyToFutureInstances });
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId === 'new') {
      handleSave(false);
    } else {
      setModal({ type: 'edit' });
    }
  };

  const handleToggle = (t) => {
    if (t.isActive) {
      setModal({ type: 'deactivate', templateId: t.id });
    } else {
      // Reactivating — no cascade needed
      executeToggle(t.id, false);
    }
  };

  const executeToggle = async (templateId, applyToFutureInstances) => {
    setModal(null);
    setError(null);
    try {
      await toggleTemplate(templateId, applyToFutureInstances);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle template');
    }
  };

  const handleDelete = (t) => {
    setModal({ type: 'delete', templateId: t.id });
  };

  const executeDelete = async (templateId, applyToFutureInstances) => {
    setModal(null);
    setError(null);
    try {
      await deleteTemplate(templateId, applyToFutureInstances);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete template');
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--booking-text-on-light)' }}>Session Management</h2>
        {editingId === null && (
          <button className="bk-btn bk-btn--primary" onClick={openCreate}>+ New Template</button>
        )}
      </div>

      {error && <p style={{ color: 'var(--booking-danger)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p>}

      {/* Create / Edit form */}
      {editingId !== null && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--booking-bg-light)', borderRadius: 'var(--booking-radius)', padding: '1.25rem', marginBottom: '1rem', border: '2px solid var(--booking-accent)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>{editingId === 'new' ? 'New Template' : 'Edit Template'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Day
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))} className="bk-select" required>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Start time
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="bk-input" required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              End time
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="bk-input" required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Capacity
              <input type="number" min="1" value={form.openSlots} onChange={e => setForm(f => ({ ...f, openSlots: e.target.value }))} className="bk-input" required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Min age (optional)
              <input type="number" min="0" value={form.minAge} onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} className="bk-input" placeholder="None" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Competitive slots (optional)
              <input type="number" min="1" value={form.competitiveSlots} onChange={e => setForm(f => ({ ...f, competitiveSlots: e.target.value }))} className="bk-input" placeholder="No cap" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Price per gymnast (£)
              <input type="number" step="0.01" min="0.01" value={form.pricePerGymnast} onChange={e => setForm(f => ({ ...f, pricePerGymnast: e.target.value }))} className="bk-input" required />
            </label>
            <label className="auth-label">Session type
              <select name="type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="auth-input">
                <option value="TRAMPOLINE">Trampoline</option>
                <option value="DMT">DMT</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Start date (optional)
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="bk-input" />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
            Session information (optional)
            <RichTextEditor key={editingId} value={form.information} onChange={v => setForm(f => ({ ...f, information: v }))} />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={saving} className="bk-btn bk-btn--primary">{saving ? 'Saving\u2026' : 'Save'}</button>
            <button type="button" className="bk-btn bk-btn--ghost" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {/* Template list */}
      {!loading && templates.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          {[['ALL', 'All types'], ['TRAMPOLINE', 'Trampoline'], ['DMT', 'DMT']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => setFilterType(val)} style={{
              fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer', border: 'none',
              background: filterType === val ? (val === 'DMT' ? '#e67e22' : val === 'TRAMPOLINE' ? 'var(--booking-accent)' : 'var(--booking-bg-dark)') : 'var(--booking-border)',
              color: filterType === val ? '#fff' : 'var(--booking-text-muted)',
            }}>{label}</button>
          ))}
          <span style={{ width: '1px', background: 'var(--booking-border)', margin: '0 0.25rem' }} />
          {[['ALL', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => setFilterStatus(val)} style={{
              fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer', border: 'none',
              background: filterStatus === val ? 'var(--booking-bg-dark)' : 'var(--booking-border)',
              color: filterStatus === val ? '#fff' : 'var(--booking-text-muted)',
            }}>{label}</button>
          ))}
        </div>
      )}
      {loading ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>Loading\u2026</p>
      ) : templates.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No templates yet. Create one to start generating sessions.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {templates.filter(t =>
            (filterType === 'ALL' || t.type === filterType) &&
            (filterStatus === 'ALL' || (filterStatus === 'ACTIVE' ? t.isActive : !t.isActive))
          ).map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
              padding: '0.75rem 1rem',
              border: '1.5px solid var(--booking-border)',
              borderRadius: 'var(--booking-radius)',
              background: 'var(--booking-bg-white)',
              opacity: t.isActive ? 1 : 0.6,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--booking-text-on-light)' }}>
                  {DAY_NAMES[t.dayOfWeek]} {t.startTime}&ndash;{t.endTime}
                  <span style={{
                    marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem',
                    borderRadius: '999px',
                    background: t.isActive ? 'rgba(124,53,232,0.12)' : 'rgba(0,0,0,0.07)',
                    color: t.isActive ? 'var(--booking-accent)' : 'var(--booking-text-muted)',
                  }}>{t.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)', marginTop: '0.15rem' }}>
                  {t.openSlots} slots &middot; £{(t.pricePerGymnast / 100).toFixed(2)}{t.minAge ? ` \u00b7 ${t.minAge}+` : ''}
                  {t.information && <span> &middot; <em>Has info text</em></span>}
                  {t.startDate && <span> &middot; from {new Date(t.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {t.type === 'DMT' && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: '#e67e22', borderRadius: 3, padding: '0 5px' }}>DMT</span>}
                  {t.type === 'TRAMPOLINE' && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: 'var(--booking-accent)', borderRadius: 3, padding: '0 5px' }}>Trampoline</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => togglePanel(t.id)}>
                  {openPanels[t.id] ? 'Hide slots' : 'View slots'}
                </button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => openEdit(t)}>Edit</button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => handleToggle(t)}>
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem', color: 'var(--booking-danger)' }} onClick={() => handleDelete(t)}>Delete</button>
              </div>
              {openPanels[t.id] && (() => {
                const pd = panelData[t.id];
                const commitments = pd?.commitments || [];
                const active = commitments.filter(c => c.status === 'ACTIVE').sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
                const paused = commitments.filter(c => c.status === 'PAUSED').sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
                const waitlisted = commitments.filter(c => c.status === 'WAITLISTED').sort((a, b) => a.createdAt < b.createdAt ? -1 : (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : 1));
                const hasSlotAvailable = t.competitiveSlots !== null && active.length < t.competitiveSlots && waitlisted.length > 0;
                const slotsLabel = t.competitiveSlots !== null ? `${active.length} / ${t.competitiveSlots} competitive slots` : null;
                return (
                  <div style={{ width: '100%', borderTop: '1px solid var(--booking-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    {pd?.loading && <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading...</p>}
                    {pd?.error && <p style={{ color: 'var(--booking-danger)', fontSize: '0.85rem', margin: 0 }}>{pd.error}</p>}
                    {pd && !pd.loading && !pd.error && (
                      <>
                        {slotsLabel && (
                          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--booking-text-muted)' }}>{slotsLabel}</span>
                            {hasSlotAvailable && (
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: 'var(--booking-success)', borderRadius: 4, padding: '0.1rem 0.5rem' }}>
                                {t.competitiveSlots - active.length} slot{t.competitiveSlots - active.length !== 1 ? 's' : ''} available \u2014 {waitlisted.length} on waitlist
                              </span>
                            )}
                          </div>
                        )}
                        {commitments.length === 0 && <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.85rem', margin: 0 }}>No commitments yet.</p>}
                        {active.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Active</div>
                            {active.map(c => {
                              const isFuture = c.status === 'ACTIVE' && c.startDate && new Date(c.startDate) > new Date();
                              const startsBadge = isFuture
                                ? new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : null;
                              return (
                                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
                                  <span>
                                    {c.gymnast.firstName} {c.gymnast.lastName}
                                    {isFuture && (
                                      <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#1565c0', background: '#e3f2fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                        Starts {startsBadge}
                                      </span>
                                    )}
                                  </span>
                                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    {!isFuture && <button className="bk-btn bk-btn--sm" onClick={() => handlePauseCommitment(t.id, c.id)}>Pause</button>}
                                    <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {paused.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Paused</div>
                            {paused.map(c => (
                              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
                                <span>{c.gymnast.firstName} {c.gymnast.lastName}</span>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button className="bk-btn bk-btn--sm" onClick={() => handleActivateCommitment(t.id, c.id)}>Activate</button>
                                  <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {waitlisted.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Waitlist</div>
                            {waitlisted.map((c, idx) => (
                              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
                                <span><span style={{ color: 'var(--booking-text-muted)', marginRight: '0.4rem' }}>#{idx + 1}</span>{c.gymnast.firstName} {c.gymnast.lastName}</span>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button
                                    className="bk-btn bk-btn--sm"
                                    disabled={!hasSlotAvailable && !(t.competitiveSlots === null)}
                                    onClick={() => handleActivateCommitment(t.id, c.id)}
                                  >
                                    Promote
                                  </button>
                                  <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modals */}
      {modal?.type === 'edit' && (
        <ConfirmModal
          message="Apply these changes to already-scheduled future sessions that have no confirmed bookings?"
          onYes={() => handleSave(true)}
          onNo={() => handleSave(false)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'deactivate' && (
        <ConfirmModal
          message="Stop generating new sessions for this template. Also cancel future sessions with no confirmed bookings?"
          onYes={() => executeToggle(modal.templateId, true)}
          onNo={() => executeToggle(modal.templateId, false)}
          onCancel={() => setModal(null)}
          yesLabel="Yes, cancel future sessions"
          noLabel="No, keep future sessions"
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          message="Permanently delete this template. Also delete future sessions with no confirmed bookings? This cannot be undone."
          onYes={() => executeDelete(modal.templateId, true)}
          onNo={() => executeDelete(modal.templateId, false)}
          onCancel={() => setModal(null)}
          yesLabel="Yes, delete and cancel future sessions"
          noLabel="Yes, delete only"
        />
      )}
    </div>
  );
}
