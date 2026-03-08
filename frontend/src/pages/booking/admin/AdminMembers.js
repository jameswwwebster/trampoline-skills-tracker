import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const ROLE_LABELS = { CLUB_ADMIN: 'Admin', COACH: 'Coach', PARENT: 'Parent', GYMNAST: 'Gymnast' };
const CONSENT_LABELS = { photo_coaching: 'Coaching photos', photo_social_media: 'Social media' };

function AssignCreditForm({ userId, onDone }) {
  const [form, setForm] = useState({ amount: '', expiresInDays: 90 });
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
  { value: 'PARENT', label: 'Parent' },
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
  ACTIVE:    { color: 'var(--booking-success)', bg: 'rgba(39,174,96,0.12)' },
  PAUSED:    { color: '#e67e22', bg: 'rgba(230,126,34,0.12)' },
  CANCELLED: { color: 'var(--booking-danger)', bg: 'rgba(231,76,60,0.1)' },
};

function GymnastMembership({ gymnast, membership, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
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

  const style = membership ? STATUS_STYLES[membership.status] : null;

  return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--booking-bg-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Membership</span>
        {membership ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '1px 8px', borderRadius: 4, background: style.bg, color: style.color }}>
              {membership.status}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>£{(membership.monthlyAmount / 100).toFixed(2)}/mo</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>Ad-hoc</span>
        )}
      </div>

      {error && <p className="bk-error" style={{ marginTop: '0.3rem' }}>{error}</p>}

      {membership && membership.status !== 'CANCELLED' && (
        <div className="bk-row" style={{ marginTop: '0.4rem', gap: '0.3rem' }}>
          {membership.status === 'ACTIVE' && (
            <button className="bk-btn bk-btn--sm" disabled={saving}
              style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => handleStatus('PAUSED')}>Pause</button>
          )}
          {membership.status === 'PAUSED' && (
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
              onClick={() => handleStatus('ACTIVE')}>Resume</button>
          )}
          <button className="bk-btn bk-btn--sm" disabled={saving}
            style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
            onClick={() => handleStatus('CANCELLED')}>Cancel membership</button>
        </div>
      )}

      {!membership && !showForm && (
        <button className="bk-btn bk-btn--sm" style={{ marginTop: '0.4rem', border: '1px solid var(--booking-border)' }}
          onClick={() => setShowForm(true)}>+ Add monthly membership</button>
      )}

      {showForm && (
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

function MemberDetail({ userId, onRemoved }) {
  const [member, setMember] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [assigningCredit, setAssigningCredit] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(false);
  const [confirmRemoveGymnast, setConfirmRemoveGymnast] = useState(null); // gymnast id
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildForm, setAddChildForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
  const [addingChild, setAddingChild] = useState(false);
  const [addChildError, setAddChildError] = useState(null);

  const handleRemoveGymnast = async (gymnastId) => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await bookingApi.deleteGymnast(gymnastId);
      setConfirmRemoveGymnast(null);
      load();
    } catch (err) {
      setRemoveError(err.response?.data?.error || 'Failed to remove gymnast.');
    } finally {
      setRemoving(false);
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
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]);

  if (loading) return <p className="bk-muted" style={{ padding: '1rem' }}>Loading...</p>;
  if (!member) return null;

  const totalCredits = member.credits.reduce((s, c) => s + c.amount, 0);

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'var(--booking-accent-gradient)',
        borderRadius: 'var(--booking-radius-lg)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1rem',
        color: '#fff',
      }}>
        <div>
          <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {ROLE_LABELS[member.role] ?? member.role}
            {member.isArchived && <span style={{ marginLeft: '0.5rem', background: 'rgba(231,76,60,0.4)', padding: '1px 6px', borderRadius: 4 }}>Archived</span>}
          </p>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700 }}>
            {member.firstName} {member.lastName}
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85 }}>{member.email}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
            Member since {new Date(member.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          {!confirmRemoveMember ? (
            <button
              className="bk-btn bk-btn--sm"
              style={{ background: 'rgba(231,76,60,0.2)', color: '#fff', border: '1px solid rgba(231,76,60,0.6)' }}
              onClick={() => setConfirmRemoveMember(true)}
            >
              Remove member
            </button>
          ) : (
            <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.5)', borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem' }}>Remove {member.firstName} and all their children? This cannot be undone.</p>
              {removeError && <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: '#ff9999' }}>{removeError}</p>}
              <div className="bk-row" style={{ gap: '0.4rem' }}>
                <button className="bk-btn bk-btn--sm" disabled={removing}
                  style={{ background: 'rgba(231,76,60,0.7)', color: '#fff', border: 'none' }}
                  onClick={handleRemoveMember}>{removing ? 'Removing...' : 'Confirm remove'}</button>
                <button className="bk-btn bk-btn--sm" style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }}
                  onClick={() => { setConfirmRemoveMember(false); setRemoveError(null); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile edit */}
      <div className="bk-card" style={{ marginBottom: '1rem' }}>
        <div className="bk-row bk-row--between">
          <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>Profile</h4>
          {!editingProfile && (
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={() => setEditingProfile(true)}>
              Edit
            </button>
          )}
        </div>
        {editingProfile ? (
          <EditProfileForm member={member} onDone={() => { setEditingProfile(false); load(); }} />
        ) : (
          <>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 1rem' }}>
              <span className="bk-muted">Name</span><span>{member.firstName} {member.lastName}</span>
              <span className="bk-muted">Email</span><span>{member.email}</span>
              <span className="bk-muted">Phone</span>
              <span>
                {member.phone
                  ? <a href={`tel:${member.phone}`} style={{ color: 'var(--booking-accent)' }}>{member.phone}</a>
                  : <span style={{ color: 'var(--booking-danger)' }}>No phone number</span>}
              </span>
              <span className="bk-muted">Role</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {ROLE_LABELS[member.role] ?? member.role}
                {!editingProfile && (
                  <button className="bk-btn bk-btn--sm"
                    style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', border: '1px solid var(--booking-border)' }}
                    onClick={() => setEditingRole(v => !v)}>
                    Change
                  </button>
                )}
              </span>
            </div>
            {editingRole && (
              <RoleSelector
                member={member}
                onDone={() => { setEditingRole(false); load(); }}
              />
            )}
          </>
        )}
      </div>

      {/* Credits */}
      <div className="bk-card" style={{ marginBottom: '1rem' }}>
        <div className="bk-row bk-row--between" style={{ marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>Credits</h4>
          {totalCredits > 0 && (
            <strong style={{ color: 'var(--booking-accent)' }}>£{(totalCredits / 100).toFixed(2)} available</strong>
          )}
        </div>
        {member.credits.length === 0 ? (
          <p className="bk-muted" style={{ margin: '0 0 0.5rem' }}>No active credits.</p>
        ) : (
          <div style={{ marginBottom: '0.5rem' }}>
            {member.credits.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)' }}>
                <span>£{(c.amount / 100).toFixed(2)}</span>
                <span className="bk-muted">Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        )}
        {assigningCredit ? (
          <AssignCreditForm userId={member.id} onDone={() => { setAssigningCredit(false); load(); }} />
        ) : (
          <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setAssigningCredit(true)}>
            + Assign credit
          </button>
        )}
      </div>

      {/* Gymnasts */}
      <div className="bk-card">
        <div className="bk-row bk-row--between" style={{ marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>Gymnasts</h4>
          {!showAddChild && (
            <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setShowAddChild(true)}>+ Add child</button>
          )}
        </div>

        {member.gymnasts.length === 0 && !showAddChild && (
          <p className="bk-muted" style={{ margin: '0 0 0.5rem' }}>No gymnasts linked.</p>
        )}

        {member.gymnasts.map(g => (
            <div key={g.id} style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--booking-bg-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{g.firstName} {g.lastName}{g.isSelf ? ' (self)' : ''}</strong>
                <span className="bk-muted" style={{ fontSize: '0.8rem' }}>{g.pastSessionCount} session{g.pastSessionCount !== 1 ? 's' : ''}</span>
              </div>

              {g.dateOfBirth && (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                  DOB: {new Date(g.dateOfBirth).toLocaleDateString('en-GB')}
                </p>
              )}

              {g.emergencyContactName ? (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
                  Emergency: <strong style={{ color: 'var(--booking-text-on-light)' }}>{g.emergencyContactName}</strong>
                  {g.emergencyContactRelationship && ` (${g.emergencyContactRelationship})`}
                  {' · '}
                  <a href={`tel:${g.emergencyContactPhone}`} style={{ color: 'var(--booking-accent)' }}>{g.emergencyContactPhone}</a>
                </p>
              ) : g.isSelf ? (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>No emergency contact</p>
              ) : null}

              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                <span className="bk-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Health notes</span>
                <span style={{ color: g.healthNotes === 'none' ? 'var(--booking-text-muted)' : 'inherit' }}>
                  {g.healthNotes === 'none'
                    ? 'No known health issues or learning differences'
                    : g.healthNotes || <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
                </span>
              </div>

              <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {Object.entries(CONSENT_LABELS).map(([type, label]) => {
                  const granted = g.consents?.find(c => c.type === type)?.granted;
                  return (
                    <span key={type} style={{
                      padding: '1px 7px', borderRadius: 4, fontSize: '0.75rem',
                      background: granted ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.1)',
                      color: granted ? 'var(--booking-success)' : 'var(--booking-danger)',
                    }}>
                      {granted ? '✓' : '✗'} {label}
                    </span>
                  );
                })}
                {g.pastSessionCount >= 2 && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 4, fontSize: '0.75rem',
                    background: g.bgInsuranceConfirmed ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.1)',
                    color: g.bgInsuranceConfirmed ? 'var(--booking-success)' : 'var(--booking-danger)',
                  }}>
                    {g.bgInsuranceConfirmed ? '✓' : '✗'} BG insurance
                  </span>
                )}
              </div>

              <GymnastMembership
                gymnast={g}
                membership={memberships.find(m => m.gymnastId === g.id && m.status !== 'CANCELLED') ?? null}
                onRefresh={load}
              />

              {!g.isSelf && (
                <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--booking-bg-light)' }}>
                  {confirmRemoveGymnast === g.id ? (
                    <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem' }}>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
                        Remove {g.firstName} {g.lastName}? This will delete all their booking history.
                      </p>
                      {removeError && <p className="bk-error" style={{ marginBottom: '0.4rem' }}>{removeError}</p>}
                      <div className="bk-row" style={{ gap: '0.4rem' }}>
                        <button className="bk-btn bk-btn--sm" disabled={removing}
                          style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                          onClick={() => handleRemoveGymnast(g.id)}>{removing ? 'Removing...' : 'Confirm remove'}</button>
                        <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
                          onClick={() => { setConfirmRemoveGymnast(null); setRemoveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="bk-btn bk-btn--sm"
                      style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)', fontSize: '0.78rem' }}
                      onClick={() => setConfirmRemoveGymnast(g.id)}>Remove child</button>
                  )}
                </div>
              )}
            </div>
          ))}

        {showAddChild && (
          <form onSubmit={handleAddChild} style={{ marginTop: member.gymnasts.length > 0 ? '0.75rem' : 0, paddingTop: member.gymnasts.length > 0 ? '0.75rem' : 0, borderTop: member.gymnasts.length > 0 ? '1px solid var(--booking-bg-light)' : 'none' }}>
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
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem', marginBottom: '0.5rem', display: 'block' }}>Date of birth
              <input type="date" className="bk-input" value={addChildForm.dateOfBirth}
                onChange={e => setAddChildForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: '0.5rem 0 0' }}>
              <label className="bk-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'normal' }}>
                <input
                  type="checkbox"
                  checked={addChildForm.healthNotesNone}
                  onChange={e => setAddChildForm(f => ({ ...f, healthNotesNone: e.target.checked }))}
                  style={{ marginTop: '0.2rem' }}
                />
                No known health issues or learning differences
              </label>
              <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>
                Health issues or learning differences
                <textarea
                  className="bk-input"
                  value={addChildForm.healthNotes}
                  disabled={addChildForm.healthNotesNone}
                  onChange={e => setAddChildForm(f => ({ ...f, healthNotes: e.target.value }))}
                  rows={2}
                  placeholder="Describe any conditions or confirm none above"
                  style={{ marginTop: '0.2rem', opacity: addChildForm.healthNotesNone ? 0.5 : 1 }}
                />
              </label>
            </fieldset>
            {addChildError && <p className="bk-error">{addChildError}</p>}
            <div className="bk-row" style={{ gap: '0.4rem' }}>
              <button type="submit" disabled={addingChild} className="bk-btn bk-btn--sm bk-btn--primary">
                {addingChild ? 'Adding...' : 'Add child'}
              </button>
              <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => { setShowAddChild(false); setAddChildForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false }); setAddChildError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [childrenByUser, setChildrenByUser] = useState({}); // userId → "First Last, ..."
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

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

        setMembers(users);
        setChildrenByUser(map);
      })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const q = search.toLowerCase();
  const filtered = members.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email} ${childrenByUser[u.id] || ''}`.toLowerCase().includes(q)
  );

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--xl">
      <h2 style={{ marginBottom: '1.25rem' }}>Members</h2>

      <input
        className="bk-input"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {filtered.length === 0 && <p className="bk-muted">No members found.</p>}
        {filtered.map(u => {
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
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {u.firstName} {u.lastName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)', marginTop: '0.1rem' }}>
                    {u.email}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: 'var(--booking-text-muted)',
                  }}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)', display: 'inline-block', transition: 'transform 0.2s', transform: isSelected ? 'rotate(180deg)' : 'none' }}>▾</span>
                </div>
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
    </div>
  );
}
