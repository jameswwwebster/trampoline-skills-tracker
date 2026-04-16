import React, { useState, useEffect } from 'react';
import { bookingApi, getTemplates } from '../../../utils/bookingApi';
import AdminRemovedMembers from './AdminRemovedMembers';
import '../booking-shared.css';

const waLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '44')}`;

const ROLE_LABELS = { CLUB_ADMIN: 'Admin', COACH: 'Coach', WELFARE: 'Welfare', ADULT: 'Adult', GYMNAST: 'Gymnast' };
const ROLE_COLORS = {
  CLUB_ADMIN: { background: 'rgba(124,53,232,0.12)', color: 'var(--booking-accent)' },
  COACH:      { background: 'rgba(41,128,185,0.12)', color: '#2980b9' },
  ADULT:      { background: 'rgba(39,174,96,0.12)',  color: '#27ae60' },
  GYMNAST:    { background: 'rgba(230,126,34,0.12)', color: '#e67e22' },
};

function AssignCreditForm({ userId, onDone }) {
  const [form, setForm] = useState({ amount: '', expiresInDays: 90, note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.assignCredit({
        userId,
        amount: Math.round(parseFloat(form.amount) * 100),
        expiresInDays: parseInt(form.expiresInDays),
        note: form.note || undefined,
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign credit.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <div className="bk-grid-2">
        <label className="bk-label" style={{ fontWeight: 'normal' }}>Amount (£)
          <input type="number" step="0.01" min="0.01" className="bk-input"
            value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            required style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label" style={{ fontWeight: 'normal' }}>Expires after (days)
          <input type="number" min="1" className="bk-input"
            value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))}
            required style={{ marginTop: '0.25rem' }} />
        </label>
      </div>
      <label className="bk-label" style={{ fontWeight: 'normal', marginTop: '0.5rem' }}>Note (optional)
        <input type="text" maxLength={200} className="bk-input"
          value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="e.g. Missed session refund" style={{ marginTop: '0.25rem' }} />
      </label>
      {error && <p className="bk-error">{error}</p>}
      <div className="bk-row">
        <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary bk-btn--sm">
          {submitting ? 'Assigning...' : 'Assign credit'}
        </button>
        <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditProfileForm({ member, onDone }) {
  const [form, setForm] = useState({ firstName: member.firstName, lastName: member.lastName, email: member.email, phone: member.phone || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await bookingApi.updateMemberProfile(member.id, form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <div className="bk-grid-2">
        <label className="bk-label" style={{ fontWeight: 'normal' }}>First name
          <input className="bk-input" value={form.firstName}
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            required style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label" style={{ fontWeight: 'normal' }}>Last name
          <input className="bk-input" value={form.lastName}
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            required style={{ marginTop: '0.25rem' }} />
        </label>
      </div>
      <label className="bk-label" style={{ fontWeight: 'normal' }}>Email
        <input type="email" className="bk-input" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required style={{ marginTop: '0.25rem' }} />
      </label>
      <label className="bk-label" style={{ fontWeight: 'normal' }}>Phone number
        <input type="tel" className="bk-input" value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          style={{ marginTop: '0.25rem' }} />
      </label>
      {error && <p className="bk-error">{error}</p>}
      <div className="bk-row">
        <button type="submit" disabled={saving} className="bk-btn bk-btn--primary bk-btn--sm">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const ASSIGNABLE_ROLES = [
  { value: 'CLUB_ADMIN', label: 'Admin' },
  { value: 'COACH', label: 'Coach' },
  { value: 'WELFARE', label: 'Welfare' },
  { value: 'ADULT', label: 'Adult' },
  { value: 'GYMNAST', label: 'Gymnast' },
];

function RoleSelector({ member, onDone }) {
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleSave = async () => {
    if (role === member.role) { onDone(); return; }
    if (role === 'CLUB_ADMIN' && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await bookingApi.changeRole(member.id, role);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change role.');
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {confirming ? (
        <div>
          <p className="bk-error" style={{ marginBottom: '0.5rem' }}>
            This gives full admin access. Are you sure?
          </p>
          <div className="bk-row">
            <button className="bk-btn bk-btn--primary bk-btn--sm" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : 'Yes, make admin'}
            </button>
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => { setConfirming(false); setRole(member.role); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="bk-label" style={{ fontWeight: 'normal' }}>
            Role
            <select className="bk-select" value={role}
              onChange={e => setRole(e.target.value)}
              style={{ marginTop: '0.25rem' }}>
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          {error && <p className="bk-error">{error}</p>}
          <div className="bk-row" style={{ marginTop: '0.5rem' }}>
            <button className="bk-btn bk-btn--primary bk-btn--sm" disabled={saving || role === member.role}
              onClick={handleSave}>
              {saving ? 'Saving...' : 'Save role'}
            </button>
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={onDone}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES = {
  PENDING_PAYMENT: { color: '#e67e22', bg: 'rgba(230,126,34,0.12)' },
  ACTIVE:    { color: 'var(--booking-success)', bg: 'rgba(39,174,96,0.12)' },
  PAUSED:    { color: '#e67e22', bg: 'rgba(230,126,34,0.12)' },
  CANCELLED: { color: 'var(--booking-danger)', bg: 'rgba(231,76,60,0.1)' },
  SCHEDULED: { color: '#7c35e8', bg: 'rgba(124,53,232,0.1)' },
};


function RemoveChild({ gymnast: g, onUpdated }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await bookingApi.deleteGymnast(g.id);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove gymnast.');
      setRemoving(false);
    }
  };

  if (!confirming) return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <button className="bk-btn bk-btn--sm"
        style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)', fontSize: '0.78rem' }}
        onClick={() => setConfirming(true)}>
        Remove child
      </button>
    </div>
  );

  return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
          Remove {g.firstName} {g.lastName}? This will delete all their booking history.
        </p>
        {error && <p className="bk-error" style={{ marginBottom: '0.4rem' }}>{error}</p>}
        <div className="bk-row" style={{ gap: '0.4rem' }}>
          <button className="bk-btn bk-btn--sm" disabled={removing}
            style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
            onClick={handleRemove}>{removing ? 'Removing...' : 'Confirm remove'}</button>
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
            onClick={() => { setConfirming(false); setError(null); }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function UnlinkSelfGymnast({ gymnast: g, onUpdated }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  const handleUnlink = async () => {
    setRemoving(true);
    setError(null);
    try {
      await bookingApi.unlinkGymnastUser(g.id);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unlink gymnast.');
      setRemoving(false);
    }
  };

  if (!confirming) return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <button className="bk-btn bk-btn--sm"
        style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)', fontSize: '0.78rem' }}
        onClick={() => setConfirming(true)}>
        Unlink self as gymnast
      </button>
    </div>
  );

  return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
          Unlink this user from the {g.firstName} {g.lastName} gymnast record? The gymnast record and any booking history will be kept, but the account link will be removed.
        </p>
        {error && <p className="bk-error" style={{ marginBottom: '0.4rem' }}>{error}</p>}
        <div className="bk-row" style={{ gap: '0.4rem' }}>
          <button className="bk-btn bk-btn--sm" disabled={removing}
            style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
            onClick={handleUnlink}>{removing ? 'Unlinking...' : 'Confirm unlink'}</button>
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
            onClick={() => { setConfirming(false); setError(null); }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


const MEMBERSHIP_BADGE = {
  ACTIVE:          (m) => ({ label: `Active £${(m.monthlyAmount/100).toFixed(2)}/mo`,  color: 'var(--booking-success)', bg: 'rgba(39,174,96,0.12)' }),
  PAUSED:          (m) => ({ label: `Paused £${(m.monthlyAmount/100).toFixed(2)}/mo`,  color: '#e67e22', bg: 'rgba(230,126,34,0.12)' }),
  PENDING_PAYMENT: ()  => ({ label: 'Pending payment',                                  color: '#e67e22', bg: 'rgba(230,126,34,0.12)' }),
  SCHEDULED:       (m) => ({ label: `Scheduled £${(m.monthlyAmount/100).toFixed(2)}/mo`, color: '#7c35e8', bg: 'rgba(124,53,232,0.1)' }),
};

function GymnastRow({ g, memberships, templates, onUpdated }) {
  const membership = memberships.find(m => m.gymnastId === g.id && m.status !== 'CANCELLED') ?? null;

  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState({ firstName: g.firstName, lastName: g.lastName });
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState(null);

  const [editingDob, setEditingDob] = useState(false);
  const [dobValue, setDobValue] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobError, setDobError] = useState(null);
  const [dmtLoading, setDmtLoading] = useState(false);
  const [dmtError, setDmtError] = useState(null);
  const [commitments, setCommitments] = useState(null);
  const [commitmentLoading, setCommitmentLoading] = useState(false);
  const [commitmentError, setCommitmentError] = useState(null);
  const [addingTemplateId, setAddingTemplateId] = useState('');
  const defaultStartDate =
    membership?.status === 'SCHEDULED' && membership?.startDate
      ? new Date(membership.startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const [addingStartDate, setAddingStartDate] = useState(defaultStartDate);

  const [editingHealthNotes, setEditingHealthNotes] = useState(false);
  const [healthNotesValue, setHealthNotesValue] = useState(g.healthNotes === 'none' ? '' : g.healthNotes || '');
  const [healthNotesNone, setHealthNotesNone] = useState(g.healthNotes === 'none');
  const [healthNotesSaving, setHealthNotesSaving] = useState(false);
  const [healthNotesError, setHealthNotesError] = useState(null);

  const [editingBgNumber, setEditingBgNumber] = useState(false);
  const [bgInput, setBgInput] = useState(g.bgNumber || '');
  const [bgSaving, setBgSaving] = useState(false);
  const [bgError, setBgError] = useState(null);

  const handleSaveHealthNotes = async () => {
    setHealthNotesSaving(true);
    setHealthNotesError(null);
    try {
      const healthNotes = healthNotesNone ? 'none' : healthNotesValue || null;
      await bookingApi.updateHealthNotes(g.id, { healthNotes });
      setEditingHealthNotes(false);
      onUpdated();
    } catch (err) {
      setHealthNotesError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setHealthNotesSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameForm.firstName.trim() || !nameForm.lastName.trim()) {
      setNameError('First and last name are required.');
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      await bookingApi.updateGymnast(g.id, {
        firstName: nameForm.firstName.trim(),
        lastName: nameForm.lastName.trim(),
        dateOfBirth: g.dateOfBirth ? new Date(g.dateOfBirth).toISOString().slice(0, 10) : undefined,
      });
      setEditingName(false);
      onUpdated();
    } catch (err) {
      setNameError(err.response?.data?.error || 'Failed to save.');
      setNameSaving(false);
    }
  };

  const handleSaveDob = async () => {
    if (!dobValue) return;
    setDobSaving(true);
    setDobError(null);
    try {
      await bookingApi.updateGymnast(g.id, {
        firstName: g.firstName,
        lastName: g.lastName,
        dateOfBirth: dobValue,
      });
      setEditingDob(false);
      onUpdated();
    } catch (err) {
      setDobError(err.response?.data?.error || 'Failed to save.');
      setDobSaving(false);
    }
  };

  const handleDmtToggle = async () => {
    setDmtLoading(true);
    setDmtError(null);
    try {
      await bookingApi.approveDmt(g.id, !g.dmtApproved);
      onUpdated();
    } catch (err) {
      setDmtError(err.response?.data?.error || 'Failed to update DMT approval.');
    } finally {
      setDmtLoading(false);
    }
  };

  const handleSaveBgNumber = async () => {
    if (!bgInput.trim()) return;
    setBgSaving(true);
    setBgError(null);
    try {
      await bookingApi.setBgNumber(g.id, bgInput.trim());
      setEditingBgNumber(false);
      onUpdated();
    } catch (err) {
      setBgError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setBgSaving(false);
    }
  };

  const handleVerifyBgNumber = async (action) => {
    setBgSaving(true);
    setBgError(null);
    try {
      await bookingApi.verifyBgNumber(g.id, action);
      onUpdated();
    } catch (err) {
      setBgError(err.response?.data?.error || 'Failed.');
    } finally {
      setBgSaving(false);
    }
  };

  const loadCommitments = async () => {
    setCommitmentLoading(true);
    setCommitmentError(null);
    try {
      const res = await bookingApi.getCommitmentsForGymnast(g.id);
      setCommitments(res.data);
    } catch {
      setCommitmentError('Failed to load commitments.');
    } finally {
      setCommitmentLoading(false);
    }
  };

  useEffect(() => {
    loadCommitments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCommitment = async () => {
    if (!addingTemplateId) return;
    setCommitmentError(null);
    try {
      await bookingApi.createCommitment({ gymnastId: g.id, templateId: addingTemplateId, startDate: addingStartDate });
      setAddingTemplateId('');
      await loadCommitments();
    } catch (err) {
      setCommitmentError(err.response?.data?.error || 'Failed to add commitment.');
    }
  };

  const handleToggleCommitmentStatus = async (commitment) => {
    const newStatus = commitment.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setCommitmentError(null);
    try {
      await bookingApi.updateCommitmentStatus(commitment.id, newStatus);
      await loadCommitments();
    } catch (err) {
      setCommitmentError(err.response?.data?.error || 'Failed to update commitment.');
    }
  };

  const handleDeleteCommitment = async (commitmentId) => {
    if (!window.confirm('Remove this standing slot?')) return;
    setCommitmentError(null);
    try {
      await bookingApi.deleteCommitment(commitmentId);
      await loadCommitments();
    } catch (err) {
      setCommitmentError(err.response?.data?.error || 'Failed to remove commitment.');
    }
  };

  const badgeFn = membership ? MEMBERSHIP_BADGE[membership.status] : null;
  const badge = badgeFn ? badgeFn(membership) : { label: 'Ad-hoc', color: 'var(--booking-text-muted)', bg: 'var(--booking-bg-light)' };

  const bgInsuranceRequired = (g.pastSessionCount ?? 0) >= 2 || !!membership;

  const getConsentValue = (type) => g.consents?.find(c => c.type === type)?.granted;

  const hasIssues = (
    g.bgNumberStatus === 'PENDING' ||
    g.bgNumberStatus === 'INVALID' ||
    !g.dateOfBirth ||
    (bgInsuranceRequired && !g.bgNumber) ||
    (g.isSelf && !g.emergencyContactName)
  );

  const infoItemStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '0.25rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
    gap: '0.75rem', fontSize: '0.82rem',
  };
  const keyStyle = { color: 'var(--booking-text-muted)', flexShrink: 0 };


  return (
    <div style={{
      background: hasIssues ? '#fffaf5' : '#f9f8ff',
      border: `1px solid ${hasIssues ? 'rgba(230,126,34,0.4)' : '#e8e0ff'}`,
      borderRadius: 'var(--booking-radius)',
      padding: '0.75rem',
      marginBottom: '0.5rem',
    }}>
      {/* Header: name + membership badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {editingName ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', flex: 1 }}>
            <input className="bk-input" style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: '120px' }}
              placeholder="First name" value={nameForm.firstName}
              onChange={e => setNameForm(f => ({ ...f, firstName: e.target.value }))} autoFocus />
            <input className="bk-input" style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: '120px' }}
              placeholder="Last name" value={nameForm.lastName}
              onChange={e => setNameForm(f => ({ ...f, lastName: e.target.value }))} />
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={nameSaving} onClick={handleSaveName} style={{ fontSize: '0.75rem' }}>
              {nameSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="bk-btn bk-btn--sm" onClick={() => { setEditingName(false); setNameError(null); setNameForm({ firstName: g.firstName, lastName: g.lastName }); }}
              style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}>
              Cancel
            </button>
            {nameError && <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{nameError}</span>}
          </span>
        ) : (
          <strong style={{ fontSize: '0.9rem' }}>
            {g.firstName} {g.lastName}
            {g.isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 400, color: 'var(--booking-text-muted)' }}>Adult participant</span>}
            {' '}
            <button onClick={() => { setNameForm({ firstName: g.firstName, lastName: g.lastName }); setEditingName(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.75rem', padding: 0, fontWeight: 400 }}>
              Edit
            </button>
          </strong>
        )}
        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '1px 8px', borderRadius: 4, background: badge.bg, color: badge.color, flexShrink: 0 }}>
          {badge.label}
        </span>
      </div>

      {/* Info list */}
      <ul style={{ listStyle: 'none', margin: '0 0 0.4rem', padding: 0 }}>
        {/* DOB */}
        <li style={infoItemStyle}>
          <span style={keyStyle}>DOB</span>
          <span>
            {editingDob ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <input type="date" className="bk-input"
                  style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: 'auto' }}
                  value={dobValue} onChange={e => setDobValue(e.target.value)} autoFocus />
                <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={dobSaving || !dobValue} onClick={handleSaveDob} style={{ fontSize: '0.75rem' }}>
                  {dobSaving ? 'Saving…' : 'Save'}
                </button>
                <button className="bk-btn bk-btn--sm" onClick={() => { setEditingDob(false); setDobError(null); }} style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}>
                  Cancel
                </button>
                {dobError && <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{dobError}</span>}
              </span>
            ) : g.dateOfBirth ? (
              <span>
                {new Date(g.dateOfBirth).toLocaleDateString('en-GB')}
                {' '}
                <button onClick={() => { setEditingDob(true); setDobValue(new Date(g.dateOfBirth).toISOString().slice(0, 10)); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.75rem', padding: 0 }}>
                  Edit
                </button>
              </span>
            ) : (
              <span style={{ color: 'var(--booking-danger)' }}>
                Missing{' '}
                <button onClick={() => { setEditingDob(true); setDobValue(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.75rem', padding: 0, fontWeight: 600 }}>
                  Set
                </button>
              </span>
            )}
          </span>
        </li>
        {/* Consents */}
        <li style={infoItemStyle}>
          <span style={keyStyle}>Coaching photos</span>
          {getConsentValue('photo_coaching')
            ? <span style={{ color: 'var(--booking-success)' }}>✓ Allowed</span>
            : <span style={{ color: 'var(--booking-danger)' }}>✗ Not allowed</span>}
        </li>
        <li style={infoItemStyle}>
          <span style={keyStyle}>Social media</span>
          {getConsentValue('photo_social_media')
            ? <span style={{ color: 'var(--booking-success)' }}>✓ Allowed</span>
            : <span style={{ color: 'var(--booking-danger)' }}>✗ Not allowed</span>}
        </li>
        {/* BG insurance */}
        {(
          <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
            <span style={keyStyle}>BG insurance</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {editingBgNumber ? (
                <>
                  <input
                    className="bk-input"
                    style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: '120px' }}
                    value={bgInput}
                    onChange={e => setBgInput(e.target.value)}
                    placeholder="BG number"
                    autoFocus
                  />
                  <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={bgSaving || !bgInput.trim()} onClick={handleSaveBgNumber} style={{ fontSize: '0.75rem' }}>
                    {bgSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="bk-btn bk-btn--sm" onClick={() => { setEditingBgNumber(false); setBgInput(g.bgNumber || ''); setBgError(null); }} style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}>
                    Cancel
                  </button>
                  {bgError && <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{bgError}</span>}
                </>
              ) : (
                <>
                  {g.bgNumberStatus === 'VERIFIED' && (
                    <span style={{ color: 'var(--booking-success)' }}>✓ Verified <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>{g.bgNumber}</span></span>
                  )}
                  {g.bgNumberStatus === 'PENDING' && (
                    <>
                      <span style={{ color: '#e67e22' }}>⚠ Pending <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{g.bgNumber}</span></span>
                      <button className="bk-btn bk-btn--sm" disabled={bgSaving} onClick={() => handleVerifyBgNumber('verify')} style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}>Verify</button>
                      <button className="bk-btn bk-btn--sm" disabled={bgSaving} onClick={() => handleVerifyBgNumber('invalidate')} style={{ fontSize: '0.75rem', border: '1px solid var(--booking-danger)', color: 'var(--booking-danger)' }}>Mark invalid</button>
                    </>
                  )}
                  {g.bgNumberStatus === 'INVALID' && (
                    <span style={{ color: 'var(--booking-danger)' }}>✗ Invalid <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{g.bgNumber}</span></span>
                  )}
                  {!g.bgNumber && (
                    <span style={{ color: 'var(--booking-danger)' }}>✗ Not provided</span>
                  )}
                  <button onClick={() => { setEditingBgNumber(true); setBgInput(g.bgNumber || ''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.75rem', padding: 0 }}>
                    {g.bgNumber ? 'Edit' : 'Set'}
                  </button>
                </>
              )}
            </span>
          </li>
        )}
        {/* DMT approval */}
        <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
          <span style={keyStyle}>DMT</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {g.dmtApproved ? (
              <span style={{ color: 'var(--booking-success)' }}>
                ✓ Approved
                {g.dmtApprovedBy && (
                  <span style={{ fontWeight: 400, color: 'var(--booking-text-muted)', marginLeft: '0.3rem' }}>
                    by {g.dmtApprovedBy.firstName} {g.dmtApprovedBy.lastName}
                    {g.dmtApprovedAt && ` on ${new Date(g.dmtApprovedAt).toLocaleDateString('en-GB')}`}
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--booking-text-muted)' }}>Not approved</span>
            )}
            <button
              className="bk-btn bk-btn--sm"
              style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}
              disabled={dmtLoading}
              onClick={handleDmtToggle}
            >
              {g.dmtApproved ? 'Revoke' : 'Approve'}
            </button>
            {dmtError && <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{dmtError}</span>}
          </span>
        </li>
        {/* Health notes */}
        <li style={{ ...infoItemStyle, ...(!g.isSelf ? { borderBottom: 'none' } : {}) }}>
          <span style={keyStyle}>Health notes</span>
          <span style={{ textAlign: 'right' }}>
            {editingHealthNotes ? (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={healthNotesNone}
                    onChange={e => {
                      setHealthNotesNone(e.target.checked);
                      if (e.target.checked) setHealthNotesValue('');
                    }}
                  />
                  No known health issues
                </label>
                {!healthNotesNone && (
                  <textarea
                    className="bk-input"
                    rows={3}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    value={healthNotesValue}
                    onChange={e => setHealthNotesValue(e.target.value)}
                    placeholder="Describe any health issues or learning differences"
                  />
                )}
                {healthNotesError && (
                  <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{healthNotesError}</span>
                )}
                <span style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className="bk-btn bk-btn--sm bk-btn--primary"
                    style={{ fontSize: '0.75rem' }}
                    disabled={healthNotesSaving}
                    onClick={handleSaveHealthNotes}
                  >
                    {healthNotesSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}
                    onClick={() => {
                      setEditingHealthNotes(false);
                      setHealthNotesValue(g.healthNotes === 'none' ? '' : g.healthNotes || '');
                      setHealthNotesNone(g.healthNotes === 'none');
                      setHealthNotesError(null);
                    }}
                  >
                    Cancel
                  </button>
                </span>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <span>
                  {g.healthNotes === 'none'
                    ? <span style={{ color: 'var(--booking-text-muted)' }}>None</span>
                    : g.healthNotes
                      ? g.healthNotes
                      : <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
                </span>
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}
                  onClick={() => {
                    setHealthNotesValue(g.healthNotes === 'none' ? '' : g.healthNotes || '');
                    setHealthNotesNone(g.healthNotes === 'none');
                    setEditingHealthNotes(true);
                  }}
                >
                  Edit
                </button>
              </span>
            )}
          </span>
        </li>
        {/* Emergency contact (adult participants only) — full details */}
        {g.isSelf && (
          <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
            <span style={keyStyle}>Emergency contact</span>
            <span style={{ textAlign: 'right' }}>
              {g.emergencyContactName
                ? <>
                    <span style={{ fontWeight: 500 }}>{g.emergencyContactName}</span>
                    {g.emergencyContactRelationship && <span style={{ color: 'var(--booking-text-muted)' }}> ({g.emergencyContactRelationship})</span>}
                    {g.emergencyContactPhone && <><br /><a href={waLink(g.emergencyContactPhone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--booking-accent)' }}>{g.emergencyContactPhone}</a></>}
                  </>
                : <span style={{ color: 'var(--booking-danger)' }}>✗ Missing</span>}
            </span>
          </li>
        )}
      </ul>

      {/* Membership & slots */}
      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--booking-bg-light)' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--booking-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
          Membership &amp; slots
        </span>

        {/* Membership management (inline — no border/margin wrapper) */}
        <GymnastMembership gymnast={g} membership={membership} onRefresh={onUpdated} />

        {/* Slots list — only when membership exists */}
        {membership && (
          <>
            {commitmentLoading && <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>Loading...</p>}
            {commitmentError && <p style={{ color: 'var(--booking-danger)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>{commitmentError}</p>}
            {commitments !== null && (
              <>
                {commitments.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>No standing slots.</p>}
                {commitments.map(c => {
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const label = `${days[c.template.dayOfWeek]} ${c.template.startTime}–${c.template.endTime}`;
                  const isFuture = c.status === 'ACTIVE' && c.startDate && new Date(c.startDate) > new Date();
                  const startsBadge = isFuture
                    ? new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null;
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.875rem' }}>
                      <span>
                        {label}
                        {isFuture ? (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#1565c0', background: '#e3f2fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            Starts {startsBadge}
                          </span>
                        ) : (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: c.status === 'ACTIVE' ? 'var(--booking-success)' : c.status === 'WAITLISTED' ? '#e67e22' : 'var(--booking-text-muted)', fontWeight: 600 }}>
                            {c.status === 'ACTIVE' ? 'Active' : c.status === 'WAITLISTED' ? 'Waitlisted' : 'Paused'}
                          </span>
                        )}
                      </span>
                      <div className="bk-row" style={{ gap: '0.3rem' }}>
                        {c.status !== 'WAITLISTED' && !isFuture && (
                          <button className="bk-btn bk-btn--sm" onClick={() => handleToggleCommitmentStatus(c)}>
                            {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                          </button>
                        )}
                        <button
                          className="bk-btn bk-btn--sm"
                          style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                          onClick={() => handleDeleteCommitment(c.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Add slot form */}
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={addingTemplateId}
                    onChange={e => setAddingTemplateId(e.target.value)}
                    className="bk-input"
                    style={{ fontSize: '0.85rem', flex: 1 }}
                  >
                    <option value="">Add standing slot...</option>
                    {(templates || []).filter(t => t.isActive && !commitments.some(c => c.templateId === t.id)).map(t => {
                      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      return <option key={t.id} value={t.id}>{days[t.dayOfWeek]} {t.startTime}–{t.endTime}{t.type === 'DMT' ? ' · DMT' : ' · Trampoline'}</option>;
                    })}
                  </select>
                  <input
                    type="date"
                    className="bk-input"
                    value={addingStartDate}
                    onChange={e => setAddingStartDate(e.target.value)}
                    style={{ fontSize: '0.85rem', width: '130px' }}
                  />
                  <button
                    className="bk-btn bk-btn--sm bk-btn--primary"
                    disabled={!addingTemplateId}
                    onClick={handleAddCommitment}
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Remove / unlink gymnast */}
      <div style={{ marginTop: '0.75rem' }}>
        {g.isSelf
          ? <UnlinkSelfGymnast gymnast={g} onUpdated={onUpdated} />
          : <RemoveChild gymnast={g} onUpdated={onUpdated} />
        }
      </div>
    </div>
  );
}

function GymnastMembership({ gymnast, membership, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [showEditAmount, setShowEditAmount] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [form, setForm] = useState({ monthlyAmount: '', startDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await bookingApi.createMembership({
        gymnastId: gymnast.id,
        monthlyAmount: Math.round(parseFloat(form.monthlyAmount) * 100),

        startDate: form.startDate,
      });
      setShowForm(false);
      setForm({ monthlyAmount: '', startDate: new Date().toISOString().slice(0, 10) });
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create membership.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status) => {
    setSaving(true);
    setError(null);
    try {
      await bookingApi.updateMembership(membership.id, { status });
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update membership.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAmount = async (prorationBehavior) => {
    setSaving(true);
    setError(null);
    try {
      await bookingApi.updateMembership(membership.id, {
        monthlyAmount: Math.round(parseFloat(editAmount) * 100),
        prorationBehavior,
      });
      setShowEditAmount(false);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update amount.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {membership && membership.status !== 'CANCELLED' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
              {membership.status === 'ACTIVE' && (
                <>Active since <strong>{new Date(membership.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> · £{(membership.monthlyAmount / 100).toFixed(2)}/mo</>
              )}
              {membership.status === 'PAUSED' && (
                <>Paused · £{(membership.monthlyAmount / 100).toFixed(2)}/mo</>
              )}
              {membership.status === 'SCHEDULED' && (
                <>Scheduled — starts <strong>{new Date(membership.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> · £{(membership.monthlyAmount / 100).toFixed(2)}/mo</>
              )}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
              {membership.status === 'ACTIVE' && (
                <button className="bk-btn bk-btn--sm" disabled={saving}
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => handleStatus('PAUSED')}>Pause</button>
              )}
              {membership.status === 'PAUSED' && (
                <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
                  onClick={() => handleStatus('ACTIVE')}>Resume</button>
              )}
              {membership.status !== 'SCHEDULED' && (
                <button className="bk-btn bk-btn--sm" disabled={saving}
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => { setEditAmount((membership.monthlyAmount / 100).toFixed(2)); setShowEditAmount(v => !v); }}>
                  Edit amount
                </button>
              )}
              <button className="bk-btn bk-btn--sm" disabled={saving}
                style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                onClick={async () => {
                  if (!window.confirm('Cancel this membership? This will stop Stripe billing immediately.')) return;
                  setSaving(true);
                  try { await bookingApi.deleteMembership(membership.id); onRefresh(); }
                  catch (err) { setError(err.response?.data?.error || 'Failed to cancel.'); setSaving(false); }
                }}>Cancel</button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>No membership</span>
          {!showForm && (
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setShowForm(true)}>+ Add monthly membership</button>
          )}
        </div>
      )}

      {error && <p className="bk-error" style={{ marginTop: '0.3rem' }}>{error}</p>}

      {membership && showEditAmount && (
        // existing edit-amount form — unchanged
        <div style={{ marginTop: '0.5rem' }}>
          <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>New monthly amount (£)
            <input type="number" step="0.01" min="0.01" className="bk-input"
              value={editAmount} onChange={e => setEditAmount(e.target.value)}
              style={{ marginTop: '0.2rem' }} />
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
              onClick={() => handleEditAmount('create_prorations')}>Apply now (pro-rata)</button>
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
              onClick={() => handleEditAmount('none')}>Apply from next month</button>
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setShowEditAmount(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        // existing add-membership form — unchanged
        <form onSubmit={handleCreate} style={{ marginTop: '0.5rem' }}>
          <div className="bk-grid-2">
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>Monthly amount (£)
              <input type="number" step="0.01" min="0.01" className="bk-input"
                value={form.monthlyAmount}
                onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>Start date
              <input type="date" className="bk-input"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
          </div>
          <div className="bk-row" style={{ gap: '0.3rem' }}>
            <button type="submit" disabled={saving} className="bk-btn bk-btn--sm bk-btn--primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

const MEMBERSHIP_STATUS_LABELS = {
  PENDING_PAYMENT: { label: 'Awaiting payment setup', color: '#e67e22' },
  ACTIVE:          { label: 'Active', color: 'var(--booking-success)' },
  PAUSED:          { label: 'Paused', color: 'var(--booking-text-muted)' },
  CANCELLED:       { label: 'Cancelled', color: 'var(--booking-danger)' },
  SCHEDULED:       { label: 'Scheduled', color: '#7c35e8' },
};

function MembershipsPanel() {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null);

  const load = () => {
    setLoading(true);
    bookingApi.getMemberships()
      .then(res => setMemberships(res.data))
      .catch(() => setError('Failed to load memberships. Please refresh.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleNotifyScheduled = async () => {
    const count = memberships.filter(m => m.status === 'SCHEDULED' && !m.scheduledNotifiedAt).length;
    if (!window.confirm(`Send a "membership scheduled" email to ${count} guardian${count !== 1 ? 's' : ''}?`)) return;
    setNotifying(true);
    setNotifyResult(null);
    try {
      const res = await bookingApi.notifyScheduledMemberships();
      setNotifyResult(`Sent ${res.data.sent} email${res.data.sent !== 1 ? 's' : ''}.`);
      load();
    } catch {
      setNotifyResult('Failed to send notifications.');
    } finally {
      setNotifying(false);
    }
  };

  const handleStatus = async (id, status) => {
    setSaving(s => ({ ...s, [id]: true }));
    setError(null);
    try {
      await bookingApi.updateMembership(id, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update.');
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this membership? This will stop Stripe billing immediately.')) return;
    setSaving(s => ({ ...s, [id]: true }));
    try {
      await bookingApi.deleteMembership(id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel.');
      setSaving(s => ({ ...s, [id]: false }));
    }
  };

  const visible = memberships.filter(m => m.status !== 'CANCELLED');

  if (loading) return <p className="bk-muted">Loading...</p>;
  if (error && visible.length === 0) return <p className="bk-error">{error}</p>;
  if (visible.length === 0) return <p className="bk-muted">No active memberships.</p>;

  const unnotifiedCount = memberships.filter(m => m.status === 'SCHEDULED' && !m.scheduledNotifiedAt).length;

  return (
    <>
      {error && <p className="bk-error">{error}</p>}
      {unnotifiedCount > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.85rem' }} disabled={notifying} onClick={handleNotifyScheduled}>
            {notifying ? 'Sending…' : `Notify scheduled members (${unnotifiedCount})`}
          </button>
          {notifyResult && <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>{notifyResult}</span>}
        </div>
      )}
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
          {visible.map(m => {
            const s = MEMBERSHIP_STATUS_LABELS[m.status] || { label: m.status, color: 'inherit' };
            return (
              <tr key={m.id}>
                <td>{m.gymnast.firstName} {m.gymnast.lastName}</td>
                <td style={{ textAlign: 'right' }}>£{(m.monthlyAmount / 100).toFixed(2)}</td>
                <td><span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</span></td>
                <td>
                  <div className="bk-row">
                    {m.status === 'ACTIVE' && (
                      <button onClick={() => handleStatus(m.id, 'PAUSED')} disabled={saving[m.id]} className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}>Pause</button>
                    )}
                    {m.status === 'PAUSED' && (
                      <button onClick={() => handleStatus(m.id, 'ACTIVE')} disabled={saving[m.id]} className="bk-btn bk-btn--sm bk-btn--primary">Resume</button>
                    )}
                    {m.status !== 'CANCELLED' && (
                      <button onClick={() => handleCancel(m.id)} disabled={saving[m.id]} className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}>Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function CreditsPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    bookingApi.getAllCredits()
      .then(r => setUsers(r.data))
      .catch(() => setError('Failed to load credits. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  const withCredits = users.filter(u => u.totalCredits > 0);

  if (loading) return <p className="bk-muted">Loading...</p>;
  if (error) return <p className="bk-error">{error}</p>;
  if (withCredits.length === 0) return <p className="bk-muted">No active credits.</p>;

  return (
    <table className="bk-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th style={{ textAlign: 'right' }}>Credits</th>
        </tr>
      </thead>
      <tbody>
        {withCredits.map(u => (
          <tr key={u.id}>
            <td>{u.firstName} {u.lastName}</td>
            <td className="bk-muted" style={{ fontSize: '0.85rem' }}>{u.email}</td>
            <td style={{ textAlign: 'right' }}>
              <strong style={{ color: 'var(--booking-accent)' }}>£{(u.totalCredits / 100).toFixed(2)}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MemberDetail({ userId, onRemoved }) {
  const [member, setMember] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [assigningCredit, setAssigningCredit] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildForm, setAddChildForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
  const [addingChild, setAddingChild] = useState(false);
  const [addChildError, setAddChildError] = useState(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [memberCharges, setMemberCharges] = useState(null); // null = not yet fetched
  const [chargesLoading, setChargesLoading] = useState(false);
  const [addingCharge, setAddingCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return { description: '', amount: '', dueDate: d.toISOString().split('T')[0] };
  });
  const [chargeFormError, setChargeFormError] = useState(null);
  const [submittingCharge, setSubmittingCharge] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => { getTemplates().then(r => setTemplates(r.data)).catch(() => {}); }, []);

  const handlePasswordReset = async () => {
    setSendingReset(true);
    setResetMessage(null);
    try {
      const res = await bookingApi.resetPassword(userId);
      setResetMessage({ type: 'success', text: res.data.message || 'Password reset email sent.' });
    } catch (err) {
      setResetMessage({ type: 'error', text: err.response?.data?.error || 'Failed to send reset email.' });
    } finally {
      setSendingReset(false);
    }
  };


  const handleRemoveMember = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await bookingApi.deleteMember(userId);
      onRemoved?.();
    } catch (err) {
      setRemoveError(err.response?.data?.error || 'Failed to remove member.');
      setRemoving(false);
    }
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    if (!addChildForm.healthNotesNone && !addChildForm.healthNotes.trim()) {
      setAddChildError('Please describe any health issues or learning differences, or confirm there are none.');
      return;
    }
    setAddingChild(true);
    setAddChildError(null);
    try {
      const payload = {
        userId,
        firstName: addChildForm.firstName,
        lastName: addChildForm.lastName,
        dateOfBirth: addChildForm.dateOfBirth,
        healthNotes: addChildForm.healthNotesNone ? 'none' : addChildForm.healthNotes.trim(),
      };
      await bookingApi.adminAddChild(payload);
      setShowAddChild(false);
      setAddChildForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
      load();
    } catch (err) {
      setAddChildError(err.response?.data?.error || 'Failed to add child.');
    } finally {
      setAddingChild(false);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      bookingApi.getMember(userId),
      bookingApi.getMemberships().catch(() => ({ data: [] })),
    ]).then(([mRes, memRes]) => {
      setMember(mRes.data);
      setMemberships(Array.isArray(memRes.data) ? memRes.data : []);
    }).catch(err => { console.error(err); })
    .finally(() => setLoading(false));
  };

  const loadCharges = async () => {
    setChargesLoading(true);
    try {
      const res = await bookingApi.getChargesForUser(userId);
      setMemberCharges(res.data.filter(c => !c.paidAt)); // outstanding only
    } catch {
      setMemberCharges([]);
    } finally {
      setChargesLoading(false);
    }
  };

  const handleToggleCharges = () => {
    const opening = !chargesOpen;
    setChargesOpen(opening);
    if (opening && memberCharges === null) loadCharges();
    if (!opening) setAddingCharge(false);
  };

  const handleCreateCharge = async (e) => {
    e.preventDefault();
    setChargeFormError(null);
    setSubmittingCharge(true);
    try {
      const amountPence = Math.round(parseFloat(chargeForm.amount) * 100);
      if (isNaN(amountPence) || amountPence < 1) {
        setChargeFormError('Amount must be a positive number');
        return;
      }
      await bookingApi.createCharge({
        userId,
        amount: amountPence,
        description: chargeForm.description,
        dueDate: new Date(chargeForm.dueDate).toISOString(),
      });
      const d = new Date(); d.setDate(d.getDate() + 7);
      setAddingCharge(false);
      setChargeForm({ description: '', amount: '', dueDate: d.toISOString().split('T')[0] });
      await loadCharges();
    } catch (err) {
      setChargeFormError(err.response?.data?.error || 'Failed to create charge');
    } finally {
      setSubmittingCharge(false);
    }
  };

  const handleDeleteCredit = async (creditId) => {
    if (!window.confirm('Delete this credit?')) return;
    try {
      await bookingApi.deleteCredit(creditId);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete credit');
    }
  };

  const handleDeleteCharge = async (chargeId) => {
    if (!window.confirm('Delete this charge?')) return;
    try {
      await bookingApi.deleteCharge(chargeId);
      await loadCharges();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete charge');
    }
  };

  const handleMarkAsGymnast = async (userId) => {
    if (!window.confirm('Create a gymnast record for this adult member?')) return;
    try {
      await bookingApi.markAdultAsGymnast(userId);
      load(); // refresh the member list
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create gymnast record');
    }
  };

  useEffect(() => { load(); }, [userId]);

  if (loading) return <p className="bk-muted" style={{ padding: '1rem' }}>Loading...</p>;
  if (!member) return null;

  const totalCredits = member.credits.reduce((s, c) => s + c.amount, 0);
  const outstandingChargesTotal = memberCharges ? memberCharges.reduce((s, c) => s + c.amount, 0) : 0;
  // Note: memberCharges is filtered to unpaid only in loadCharges, so no further filter needed here.

  return (
    <div>
      {/* ── Profile section ─────────────────────────── */}
      <div className="bk-card" style={{ marginBottom: '1rem' }}>
        {editingProfile ? (
          <EditProfileForm member={member} onDone={() => { setEditingProfile(false); load(); }} />
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[
                { key: 'Email', val: member.email },
                {
                  key: 'Phone', val: member.phone
                    ? <a href={waLink(member.phone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--booking-accent)' }}>{member.phone}</a>
                    : <span style={{ color: 'var(--booking-danger)' }}>No phone number</span>
                },
                {
                  key: 'Role', val: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {ROLE_LABELS[member.role] ?? member.role}
                      <button
                        className="bk-btn bk-btn--sm"
                        style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', border: '1px solid var(--booking-border)' }}
                        onClick={() => setEditingRole(v => !v)}
                      >
                        Change
                      </button>
                    </span>
                  )
                },
                {
                  key: 'Member since',
                  val: new Date(member.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                },
                              ].map(({ key, val }) => (
                <li key={key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)',
                  gap: '0.75rem', fontSize: '0.875rem',
                }}>
                  <span style={{ color: 'var(--booking-text-muted)', flexShrink: 0 }}>{key}</span>
                  <span style={{ textAlign: 'right' }}>{val}</span>
                </li>
              ))}
            </ul>

            {/* Credits row — standalone li with flex header */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              <li
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)',
                  gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer',
                }}
                onClick={() => setCreditsOpen(v => {
                  if (v) setAssigningCredit(false);
                  return !v;
                })}
              >
                <span style={{ color: 'var(--booking-text-muted)', flexShrink: 0 }}>Credits</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                  {totalCredits > 0
                    ? <span style={{ color: 'var(--booking-accent)', fontWeight: 600 }}>£{(totalCredits / 100).toFixed(2)} total</span>
                    : <span className="bk-muted">No credits</span>
                  }
                </span>
                <button
                  className="bk-btn bk-btn--sm bk-btn--primary"
                  style={{ flexShrink: 0 }}
                  onClick={e => { e.stopPropagation(); setCreditsOpen(true); setAssigningCredit(true); }}
                >
                  + Assign credit
                </button>
                <span style={{ flexShrink: 0, color: 'var(--booking-text-muted)', fontSize: '0.75rem' }}>
                  {creditsOpen ? '▴' : '▾'}
                </span>
              </li>
            </ul>

            {/* Credits inline expand */}
            {creditsOpen && (
              <div style={{
                marginTop: '0.5rem', background: 'rgba(124,53,232,0.05)',
                border: '1px solid rgba(124,53,232,0.15)', borderRadius: 'var(--booking-radius)',
                padding: '0.65rem 0.75rem',
              }}>
                {totalCredits === 0 && !assigningCredit && (
                  <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>No credits.</p>
                )}
                {member.credits.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: '0.875rem', padding: '0.2rem 0',
                    borderBottom: '1px solid var(--booking-bg-light)',
                  }}>
                    <span>£{(c.amount / 100).toFixed(2)}</span>
                    <span className="bk-muted">Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
                    {!c.usedOnBookingId && (
                      <button
                        className="bk-btn bk-btn--sm"
                        style={{ fontSize: '0.75rem', color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                        onClick={() => handleDeleteCredit(c.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
                {assigningCredit && (
                  <AssignCreditForm userId={member.id} onDone={() => { setAssigningCredit(false); load(); }} />
                )}
              </div>
            )}

            {/* Charges row — standalone li with flex header */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              <li
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)',
                  gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer',
                }}
                onClick={handleToggleCharges}
              >
                <span style={{ color: 'var(--booking-text-muted)', flexShrink: 0 }}>Charges</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto',
                  color: outstandingChargesTotal > 0 ? 'var(--booking-danger)' : 'var(--booking-text-muted)',
                  fontWeight: outstandingChargesTotal > 0 ? 600 : 'normal',
                }}>
                  {memberCharges === null
                    ? 'View charges'
                    : outstandingChargesTotal > 0
                      ? `£${(outstandingChargesTotal / 100).toFixed(2)} outstanding`
                      : 'No outstanding charges'
                  }
                </span>
                <button
                  className="bk-btn bk-btn--sm bk-btn--primary"
                  style={{ flexShrink: 0 }}
                  onClick={e => {
                    e.stopPropagation();
                    setChargesOpen(true);
                    setAddingCharge(true);
                    if (memberCharges === null) loadCharges();
                  }}
                >
                  + Add charge
                </button>
                <span style={{ flexShrink: 0, color: 'var(--booking-text-muted)', fontSize: '0.75rem' }}>
                  {chargesOpen ? '▴' : '▾'}
                </span>
              </li>
            </ul>

            {member.isArchived && (
              <span style={{
                display: 'inline-block', marginTop: '0.5rem',
                fontSize: '0.75rem', fontWeight: 600, padding: '1px 8px', borderRadius: 4,
                background: 'rgba(231,76,60,0.1)', color: 'var(--booking-danger)',
              }}>
                Archived
              </span>
            )}

            {chargesOpen && (
              <div style={{
                marginTop: '0.5rem',
                background: 'rgba(231,76,60,0.03)',
                border: '1px solid rgba(231,76,60,0.15)',
                borderRadius: 'var(--booking-radius)',
                padding: '0.65rem 0.75rem',
              }}>
                {chargesLoading && <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading...</p>}
                {!chargesLoading && memberCharges !== null && (
                  <>
                    {memberCharges.length === 0 && !addingCharge && (
                      <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>No outstanding charges.</p>
                    )}
                    {memberCharges.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.875rem', padding: '0.2rem 0', borderBottom: '1px solid var(--booking-bg-light)',
                      }}>
                        <div>
                          <span>{c.description}</span>
                          <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                            £{(c.amount / 100).toFixed(2)} · Due {new Date(c.dueDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <button
                          className="bk-btn bk-btn--sm"
                          style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                          onClick={() => handleDeleteCharge(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {addingCharge ? (
                      <form onSubmit={handleCreateCharge} style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input className="bk-input" placeholder="Description" required value={chargeForm.description}
                          onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                        <input type="number" step="0.01" min="0.01" className="bk-input" placeholder="Amount (£)" required value={chargeForm.amount}
                          onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                        <input type="date" className="bk-input" required value={chargeForm.dueDate}
                          onChange={e => setChargeForm(f => ({ ...f, dueDate: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                        {chargeFormError && <p style={{ color: 'var(--booking-danger)', fontSize: '0.82rem', margin: 0 }}>{chargeFormError}</p>}
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="submit" className="bk-btn bk-btn--sm bk-btn--primary" disabled={submittingCharge}>
                            {submittingCharge ? 'Adding...' : 'Add charge'}
                          </button>
                          <button type="button" className="bk-btn bk-btn--sm" onClick={() => { setAddingCharge(false); setChargeFormError(null); }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button className="bk-btn bk-btn--sm bk-btn--primary" style={{ marginTop: '0.5rem' }}
                        onClick={() => setAddingCharge(true)}>
                        + Add charge
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Role change inline */}
            {editingRole && (
              <RoleSelector member={member} onDone={() => { setEditingRole(false); load(); }} />
            )}

            {/* Password reset message */}
            {resetMessage && (
              <p style={{
                margin: '0.4rem 0 0', fontSize: '0.8rem',
                color: resetMessage.type === 'success' ? 'var(--booking-success)' : 'var(--booking-danger)',
              }}>
                {resetMessage.text}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
              <button
                className="bk-btn bk-btn--sm"
                style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => setEditingProfile(true)}
              >
                Edit profile
              </button>
              <button
                className="bk-btn bk-btn--sm"
                style={{ border: '1px solid var(--booking-border)' }}
                disabled={sendingReset}
                onClick={handlePasswordReset}
              >
                {sendingReset ? 'Sending…' : '↺ Password reset'}
              </button>
              {!confirmRemoveMember ? (
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ color: 'var(--booking-danger)', border: '1px solid rgba(231,76,60,0.4)' }}
                  onClick={() => setConfirmRemoveMember(true)}
                >
                  Remove member
                </button>
              ) : (
                <div style={{
                  width: '100%', marginTop: '0.25rem',
                  background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.3)',
                  borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem',
                }}>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
                    Remove {member.firstName} and all their children? This cannot be undone.
                  </p>
                  {removeError && <p className="bk-error" style={{ marginBottom: '0.4rem' }}>{removeError}</p>}
                  <div className="bk-row" style={{ gap: '0.4rem' }}>
                    <button
                      className="bk-btn bk-btn--sm" disabled={removing}
                      style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                      onClick={handleRemoveMember}
                    >
                      {removing ? 'Removing...' : 'Confirm remove'}
                    </button>
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ border: '1px solid var(--booking-border)' }}
                      onClick={() => { setConfirmRemoveMember(false); setRemoveError(null); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Gymnasts section ─────────────────────────── */}
      <div className="bk-card">
        <div className="bk-row bk-row--between" style={{ marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>
            Gymnasts
          </h4>
          {!showAddChild && (
            <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setShowAddChild(true)}>
              + Add child
            </button>
          )}
        </div>

        {member.gymnasts.length === 0 && !showAddChild && (
          <p className="bk-muted" style={{ margin: '0 0 0.5rem' }}>No gymnasts linked.</p>
        )}

        {!member.gymnasts.some(g => g.isSelf) && (
          <button
            className="bk-btn bk-btn--sm"
            style={{ marginTop: '0.5rem' }}
            onClick={() => handleMarkAsGymnast(member.id)}
          >
            Mark as gymnast
          </button>
        )}

        {[...member.gymnasts].sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0)).map(g => (
          <GymnastRow key={g.id} g={g} memberships={memberships} templates={templates} onUpdated={load} />
        ))}

        {showAddChild && (
          <form
            onSubmit={handleAddChild}
            style={{
              marginTop: member.gymnasts.length > 0 ? '0.75rem' : 0,
              paddingTop: member.gymnasts.length > 0 ? '0.75rem' : 0,
              borderTop: member.gymnasts.length > 0 ? '1px solid var(--booking-bg-light)' : 'none',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Add child</p>
            <div className="bk-grid-2" style={{ marginBottom: '0.5rem' }}>
              <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>First name
                <input className="bk-input" value={addChildForm.firstName}
                  onChange={e => setAddChildForm(f => ({ ...f, firstName: e.target.value }))}
                  required style={{ marginTop: '0.2rem' }} />
              </label>
              <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>Last name
                <input className="bk-input" value={addChildForm.lastName}
                  onChange={e => setAddChildForm(f => ({ ...f, lastName: e.target.value }))}
                  required style={{ marginTop: '0.2rem' }} />
              </label>
            </div>
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem', marginBottom: '0.5rem', display: 'block' }}>
              Date of birth
              <input type="date" className="bk-input" value={addChildForm.dateOfBirth}
                onChange={e => setAddChildForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: '0.5rem 0 0' }}>
              <label className="bk-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'normal' }}>
                <input type="checkbox" checked={addChildForm.healthNotesNone}
                  onChange={e => setAddChildForm(f => ({ ...f, healthNotesNone: e.target.checked }))}
                  className="bk-checkbox" />
                No known health issues or learning differences
              </label>
              <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>
                Health issues or learning differences
                <textarea className="bk-input" value={addChildForm.healthNotes}
                  disabled={addChildForm.healthNotesNone}
                  onChange={e => setAddChildForm(f => ({ ...f, healthNotes: e.target.value }))}
                  rows={2}
                  placeholder="Describe any conditions or confirm none above"
                  style={{ marginTop: '0.2rem', opacity: addChildForm.healthNotesNone ? 0.5 : 1 }} />
              </label>
            </fieldset>
            {addChildError && <p className="bk-error">{addChildError}</p>}
            <div className="bk-row" style={{ gap: '0.4rem' }}>
              <button type="submit" disabled={addingChild} className="bk-btn bk-btn--sm bk-btn--primary">
                {addingChild ? 'Adding...' : 'Add child'}
              </button>
              <button type="button" className="bk-btn bk-btn--sm"
                style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => {
                  setShowAddChild(false);
                  setAddChildForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
                  setAddChildError(null);
                }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const ASSIGNABLE_ROLES_CREATE = [
  { value: 'ADULT', label: 'Adult' },
  { value: 'COACH', label: 'Coach' },
  { value: 'WELFARE', label: 'Welfare' },
  { value: 'GYMNAST', label: 'Gymnast' },
  { value: 'CLUB_ADMIN', label: 'Admin' },
];

const EMPTY_CREATE = { firstName: '', lastName: '', email: '', phone: '', role: 'ADULT' };

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [childrenByUser, setChildrenByUser] = useState({}); // userId → "First Last, ..."
  const [gymnastsCountByUser, setGymnastsCountByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [letterFilter, setLetterFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [showRemovedMembers, setShowRemovedMembers] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => { setPage(1); }, [search, letterFilter, roleFilter]);

  const load = () =>
    bookingApi.getMembers()
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : r.data.users || [];
        const users = data.filter(u => !u.isGymnast);
        const gymnasts = data.filter(u => u.isGymnast);

        // Build map: userId → joined child names for searching
        const map = {};
        gymnasts.forEach(g => {
          (g.guardianIds || []).forEach(uid => {
            map[uid] = map[uid] ? `${map[uid]} ${g.firstName} ${g.lastName}` : `${g.firstName} ${g.lastName}`;
          });
        });

        // Build gymnast count per guardian
        const countMap = {};
        gymnasts.forEach(g => {
          (g.guardianIds || []).forEach(uid => {
            countMap[uid] = (countMap[uid] || 0) + 1;
          });
        });
        setGymnastsCountByUser(countMap);

        setMembers(users);
        setChildrenByUser(map);
      })
      .catch(() => setLoadError('Failed to load members. Please refresh.'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const res = await bookingApi.createUser(createForm);
      setCreateSuccess(
        res.data.emailSent
          ? `Account created and password reset email sent to ${res.data.user.email}.`
          : `Account created for ${res.data.user.firstName} ${res.data.user.lastName}. Use "Send password reset" to email them a login link.`
      );
      setCreateForm(EMPTY_CREATE);
      load();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const q = search.toLowerCase();
  const filtered = members.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName} ${u.email} ${childrenByUser[u.id] || ''}`.toLowerCase().includes(q);
    const matchesLetter = !letterFilter || (u.lastName || u.firstName || '').toUpperCase().startsWith(letterFilter);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesLetter && matchesRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) return <p className="bk-center">Loading...</p>;
  if (loadError) return <div className="bk-page bk-page--xl"><p className="bk-error">{loadError}</p></div>;

  return (
    <div className="bk-page bk-page--xl">
      <div className="bk-row bk-row--between" style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0 }}>Members</h2>
        <button className="bk-btn bk-btn--primary" onClick={() => { setShowCreate(v => !v); setCreateError(null); setCreateSuccess(null); }}>
          {showCreate ? 'Cancel' : '+ Create user'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bk-form-card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>New user</h3>
          <div className="bk-grid-2" style={{ marginBottom: '0.75rem' }}>
            <label className="bk-label">First name
              <input className="bk-input" value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} required style={{ marginTop: '0.25rem' }} />
            </label>
            <label className="bk-label">Last name
              <input className="bk-input" value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} required style={{ marginTop: '0.25rem' }} />
            </label>
          </div>
          <label className="bk-label" style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>Email
            <input type="email" className="bk-input" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
          </label>
          <label className="bk-label" style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>Phone{createForm.role === 'ADULT' ? '' : ' (optional)'}
            <input type="tel" className="bk-input" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} required={createForm.role === 'ADULT'} />
          </label>
          <label className="bk-label" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>Role
            <select className="bk-select" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
              {ASSIGNABLE_ROLES_CREATE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {createError && <p className="bk-error" style={{ marginBottom: '0.5rem' }}>{createError}</p>}
          {createSuccess && <p style={{ color: 'var(--booking-success)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{createSuccess}</p>}
          <button type="submit" disabled={creating} className="bk-btn bk-btn--primary">
            {creating ? 'Creating…' : 'Create user'}
          </button>
        </form>
      )}

      <input
        className="bk-input"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
      />

      {/* Role filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
        {[{ value: '', label: 'All roles' }, { value: 'CLUB_ADMIN', label: 'Admin' }, { value: 'COACH', label: 'Coach' }, { value: 'WELFARE', label: 'Welfare' }, { value: 'ADULT', label: 'Adult' }, { value: 'GYMNAST', label: 'Gymnast' }].map(opt => (
          <button
            key={opt.value}
            className="bk-btn bk-btn--sm"
            style={{
              border: '1px solid var(--booking-border)',
              fontWeight: roleFilter === opt.value ? 700 : 400,
              ...(roleFilter === opt.value && opt.value ? ROLE_COLORS[opt.value] : {}),
              ...(roleFilter === opt.value && !opt.value ? { background: 'var(--booking-accent)', color: '#fff' } : {}),
            }}
            onClick={() => setRoleFilter(opt.value)}
          >{opt.label}</button>
        ))}
      </div>

      {/* A–Z filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', margin: '0.5rem 0' }}>
        <button
          className="bk-btn bk-btn--sm"
          style={{ fontWeight: letterFilter === '' ? 700 : 400, border: '1px solid var(--booking-border)', minWidth: '2rem' }}
          onClick={() => setLetterFilter('')}
        >All</button>
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
          <button
            key={letter}
            className="bk-btn bk-btn--sm"
            style={{
              fontWeight: letterFilter === letter ? 700 : 400,
              border: '1px solid var(--booking-border)',
              background: letterFilter === letter ? 'var(--booking-accent)' : undefined,
              color: letterFilter === letter ? '#fff' : undefined,
              minWidth: '2rem',
            }}
            onClick={() => setLetterFilter(l => l === letter ? '' : letter)}
          >{letter}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {filtered.length === 0 && <p className="bk-muted">No members found.</p>}
        {paginated.map(u => {
          const isSelected = selectedId === u.id;
          return (
            <div key={u.id}>
              <button
                onClick={() => setSelectedId(prev => prev === u.id ? null : u.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '0.75rem 1rem', textAlign: 'left', font: 'inherit',
                  cursor: 'pointer',
                  border: `2px solid ${isSelected ? 'var(--booking-accent)' : 'var(--booking-border)'}`,
                  borderRadius: isSelected ? 'var(--booking-radius) var(--booking-radius) 0 0' : 'var(--booking-radius)',
                  borderBottom: isSelected ? 'none' : undefined,
                  background: isSelected ? 'rgba(124,53,232,0.06)' : 'var(--booking-bg-white)',
                  transition: 'border-color 0.15s, background 0.15s',
                  opacity: u.isArchived ? 0.5 : 1,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.firstName} {u.lastName}</span>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                      ...(ROLE_COLORS[u.role] || { background: 'rgba(0,0,0,0.08)', color: 'inherit' }),
                    }}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    {u.hasPendingBg && (
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                        background: 'rgba(230,126,34,0.12)', color: '#e67e22',
                      }}>
                        ⚠ BG pending
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--booking-text-muted)', marginTop: '0.1rem' }}>
                    {(() => {
                      const count = gymnastsCountByUser[u.id] || 0;
                      return count === 1 ? '1 gymnast' : `${count} gymnasts`;
                    })()}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.8rem', color: isSelected ? 'var(--booking-accent)' : 'var(--booking-text-muted)',
                  display: 'inline-block', transition: 'transform 0.2s',
                  flexShrink: 0, marginLeft: '0.75rem',
                }}>
                  {isSelected ? '▴' : '▾'}
                </span>
              </button>

              {isSelected && (
                <div style={{
                  border: '2px solid var(--booking-accent)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--booking-radius) var(--booking-radius)',
                  background: 'var(--booking-bg-white)',
                  padding: '1rem',
                }}>
                  <MemberDetail key={u.id} userId={u.id} onRemoved={() => { setSelectedId(null); load(); }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1rem', fontSize: '0.875rem' }}>
          <button
            className="bk-btn bk-btn--sm"
            style={{ border: '1px solid var(--booking-border)' }}
            disabled={safePage <= 1}
            onClick={() => setPage(p => p - 1)}
          >← Prev</button>
          <span style={{ color: 'var(--booking-text-muted)' }}>Page {safePage} of {totalPages}</span>
          <button
            className="bk-btn bk-btn--sm"
            style={{ border: '1px solid var(--booking-border)' }}
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >Next →</button>
        </div>
      )}


      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--booking-border)', paddingTop: '1rem' }}>
        <button
          className="bk-btn bk-btn--sm"
          style={{ border: '1px solid var(--booking-border)', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setShowRemovedMembers(v => !v)}
        >
          <span>Removed Members</span>
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showRemovedMembers ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
        {showRemovedMembers && <div style={{ marginTop: '1rem' }}><AdminRemovedMembers inline /></div>}
      </div>
    </div>
  );
}
