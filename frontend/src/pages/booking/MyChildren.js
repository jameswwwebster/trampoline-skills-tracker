import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

const CONSENT_LABELS = {
  photo_coaching: 'Photography & video for coaching purposes',
  photo_social_media: 'Photography & video for social media',
};

function ConsentToggles({ gymnast, onUpdated }) {
  const [saving, setSaving] = useState(null);

  const getGranted = (type) =>
    gymnast.consents?.find(c => c.type === type)?.granted ?? false;

  const handleToggle = async (type) => {
    setSaving(type);
    try {
      await bookingApi.updateConsents(gymnast.id, { [type]: !getGranted(type) });
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--booking-border)' }}>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Consents</p>
      {Object.entries(CONSENT_LABELS).map(([type, label]) => {
        const granted = getGranted(type);
        return (
          <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
            <span style={{
              width: 40, height: 22, borderRadius: 11, background: granted ? 'var(--booking-accent)' : 'var(--booking-border)',
              display: 'inline-flex', alignItems: 'center', padding: '0 3px', transition: 'background 0.2s',
              opacity: saving === type ? 0.6 : 1,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                transform: granted ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s',
              }} />
            </span>
            <input type="checkbox" checked={granted} onChange={() => handleToggle(type)} disabled={!!saving} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.875rem' }}>{label}</span>
          </label>
        );
      })}
    </div>
  );
}

function EmergencyContactForm({ gymnast, onSaved }) {
  const [form, setForm] = useState({
    emergencyContactName: gymnast.emergencyContactName || '',
    emergencyContactPhone: gymnast.emergencyContactPhone || '',
    emergencyContactRelationship: gymnast.emergencyContactRelationship || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await bookingApi.updateEmergencyContact(gymnast.id, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <div className="bk-grid-2">
        <label className="bk-label" style={{ fontWeight: 'normal' }}>Contact name
          <input
            className="bk-input"
            value={form.emergencyContactName}
            onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))}
            required
            style={{ marginTop: '0.25rem' }}
          />
        </label>
        <label className="bk-label" style={{ fontWeight: 'normal' }}>Phone number
          <input
            className="bk-input"
            type="tel"
            value={form.emergencyContactPhone}
            onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))}
            required
            style={{ marginTop: '0.25rem' }}
          />
        </label>
      </div>
      <label className="bk-label" style={{ fontWeight: 'normal' }}>Relationship <span className="bk-muted">(optional)</span>
        <input
          className="bk-input"
          placeholder="e.g. Parent, Spouse"
          value={form.emergencyContactRelationship}
          onChange={e => setForm(f => ({ ...f, emergencyContactRelationship: e.target.value }))}
          style={{ marginTop: '0.25rem' }}
        />
      </label>
      {error && <p className="bk-error">{error}</p>}
      <button type="submit" disabled={saving} className="bk-btn bk-btn--primary bk-btn--sm">
        {saving ? 'Saving...' : 'Save emergency contact'}
      </button>
    </form>
  );
}

function GymnastCard({ gymnast, onUpdated }) {
  const [editingEC, setEditingEC] = useState(false);
  const hasEC = !!gymnast.emergencyContactName;

  return (
    <div className="bk-card" style={{ marginBottom: '0.75rem' }}>
      <div className="bk-row bk-row--between">
        <div>
          <strong>{gymnast.firstName} {gymnast.lastName}</strong>
          {gymnast.isSelf && <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>(me)</span>}
          {gymnast.dateOfBirth && (
            <span className="bk-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>
              DOB: {new Date(gymnast.dateOfBirth).toLocaleDateString('en-GB')}
            </span>
          )}
        </div>
        <button
          className="bk-btn bk-btn--sm"
          style={{ border: '1px solid var(--booking-border)' }}
          onClick={() => setEditingEC(v => !v)}
        >
          {editingEC ? 'Cancel' : hasEC ? 'Edit emergency contact' : 'Add emergency contact'}
        </button>
      </div>

      {!editingEC && hasEC && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
          Emergency: <strong style={{ color: 'var(--booking-text-on-light)' }}>{gymnast.emergencyContactName}</strong>
          {gymnast.emergencyContactRelationship && ` (${gymnast.emergencyContactRelationship})`}
          {' · '}{gymnast.emergencyContactPhone}
        </div>
      )}

      {!editingEC && !hasEC && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--booking-danger)' }}>
          No emergency contact — please add one.
        </p>
      )}

      {editingEC && (
        <EmergencyContactForm
          gymnast={gymnast}
          onSaved={() => { setEditingEC(false); onUpdated(); }}
        />
      )}

      <ConsentToggles gymnast={gymnast} onUpdated={onUpdated} />

      <InsuranceSection gymnast={gymnast} onUpdated={onUpdated} />
    </div>
  );
}

function InsuranceSection({ gymnast, onUpdated }) {
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsInsurance = gymnast.pastSessionCount >= 2 && !gymnast.bgInsuranceConfirmed;
  const isConfirmed = gymnast.bgInsuranceConfirmed;

  if (gymnast.pastSessionCount < 2 && !isConfirmed) return null;

  const handleConfirm = async () => {
    if (!checked) return;
    setSaving(true);
    try {
      await bookingApi.confirmInsurance(gymnast.id, true);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--booking-border)' }}>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>British Gymnastics Insurance</p>
      {isConfirmed ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--booking-success)' }}>
          ✓ Confirmed{gymnast.bgInsuranceConfirmedAt ? ` on ${new Date(gymnast.bgInsuranceConfirmedAt).toLocaleDateString('en-GB')}` : ''}
        </p>
      ) : needsInsurance ? (
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--booking-danger)', marginBottom: '0.5rem' }}>
            {gymnast.firstName} has attended 2 sessions and now requires British Gymnastics insurance to continue booking.
          </p>
          {!confirming ? (
            <button className="bk-btn bk-btn--danger bk-btn--sm" onClick={() => setConfirming(true)}>
              Confirm insurance
            </button>
          ) : (
            <div>
              <label style={{ display: 'flex', gap: '0.6rem', fontSize: '0.875rem', marginBottom: '0.75rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  I confirm that {gymnast.firstName} {gymnast.lastName} has an active British Gymnastics membership
                  and has linked <strong>Trampoline Life</strong> as their club.
                </span>
              </label>
              <div className="bk-row">
                <button className="bk-btn bk-btn--primary bk-btn--sm" onClick={handleConfirm} disabled={!checked || saving}>
                  {saving ? 'Saving...' : 'Confirm'}
                </button>
                <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function MyChildren() {
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () =>
    bookingApi.getBookableGymnasts()
      .then(r => setGymnasts(r.data))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleSelf = async () => {
    setError(null);
    try {
      await bookingApi.createSelfGymnast();
      load();
    } catch (err) {
      setError('Could not create your gymnast profile.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.addChild(form);
      setForm({ firstName: '', lastName: '', dateOfBirth: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add child.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasSelf = gymnasts.some(g => g.isSelf);
  const children = gymnasts.filter(g => !g.isSelf);

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <h2>My Account</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3>Myself</h3>
        {hasSelf ? (
          gymnasts.filter(g => g.isSelf).map(g => (
            <GymnastCard key={g.id} gymnast={g} onUpdated={load} />
          ))
        ) : (
          <div>
            <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
              Add yourself to book sessions under your own name.
            </p>
            <button className="bk-btn bk-btn--primary" onClick={handleSelf}>
              Add myself as a gymnast
            </button>
          </div>
        )}
      </section>

      <section>
        <div className="bk-row bk-row--between" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Children</h3>
          <button className="bk-btn bk-btn--primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ Add child'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '1rem' }}>
            <div className="bk-grid-2">
              <label className="bk-label">First name
                <input className="bk-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required style={{ marginTop: '0.25rem' }} />
              </label>
              <label className="bk-label">Last name
                <input className="bk-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required style={{ marginTop: '0.25rem' }} />
              </label>
            </div>
            <label className="bk-label">Date of birth <span className="bk-muted">(optional — needed for age-restricted sessions)</span>
              <input type="date" className="bk-input" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} style={{ marginTop: '0.25rem' }} />
            </label>
            {error && <p className="bk-error">{error}</p>}
            <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
              {submitting ? 'Saving...' : 'Save child'}
            </button>
          </form>
        )}

        {children.length === 0 && !showForm && <p className="bk-muted">No children added yet.</p>}
        {children.map(g => (
          <GymnastCard key={g.id} gymnast={g} onUpdated={load} />
        ))}
      </section>
    </div>
  );
}
