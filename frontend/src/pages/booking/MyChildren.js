import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { bookingApi } from '../../utils/bookingApi';
import { useAuth } from '../../contexts/AuthContext';
import './booking-shared.css';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const CONSENT_LABELS = {
  photo_coaching: 'Photography & video for coaching purposes',
  photo_social_media: 'Photography & video for social media',
};

function ContactDetailsSection({ user, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: user.email || '', phone: user.phone || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/users/profile`, form, { headers: getHeaders() });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const missing = !user.email || !user.phone;

  if (!editing) {
    return (
      <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
        <div className="bk-row bk-row--between" style={{ marginBottom: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Contact details</p>
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        <div style={{ fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.3rem 0.75rem' }}>
          <span className="bk-muted">Email</span>
          <span>{user.email || <span style={{ color: 'var(--booking-danger)' }}>Not set</span>}</span>
          <span className="bk-muted">Phone</span>
          <span>{user.phone || <span style={{ color: 'var(--booking-danger)' }}>Not set</span>}</span>
        </div>
        {missing && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
            Please complete your contact details.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>Contact details</p>
      <form onSubmit={handleSubmit}>
        <label className="bk-label" style={{ fontWeight: 'normal', display: 'block', marginBottom: '0.5rem' }}>Email
          <input type="email" className="bk-input" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label" style={{ fontWeight: 'normal', display: 'block', marginBottom: '0.5rem' }}>Phone number
          <input type="tel" className="bk-input" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="e.g. 07700 900123"
            required style={{ marginTop: '0.25rem' }} />
        </label>
        {error && <p className="bk-error">{error}</p>}
        <div className="bk-row">
          <button type="submit" disabled={saving} className="bk-btn bk-btn--primary bk-btn--sm">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
            onClick={() => { setEditing(false); setForm({ email: user.email || '', phone: user.phone || '' }); }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

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
        {gymnast.isSelf && (
          <button
            className="bk-btn bk-btn--sm"
            style={{ border: '1px solid var(--booking-border)' }}
            onClick={() => setEditingEC(v => !v)}
          >
            {editingEC ? 'Cancel' : hasEC ? 'Edit emergency contact' : 'Add emergency contact'}
          </button>
        )}
      </div>

      {gymnast.isSelf && !editingEC && hasEC && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
          Emergency: <strong style={{ color: 'var(--booking-text-on-light)' }}>{gymnast.emergencyContactName}</strong>
          {gymnast.emergencyContactRelationship && ` (${gymnast.emergencyContactRelationship})`}
          {' · '}{gymnast.emergencyContactPhone}
        </div>
      )}

      {gymnast.isSelf && !editingEC && !hasEC && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--booking-danger)' }}>
          No emergency contact — please add one.
        </p>
      )}

      {gymnast.isSelf && editingEC && (
        <EmergencyContactForm
          gymnast={gymnast}
          onSaved={() => { setEditingEC(false); onUpdated(); }}
        />
      )}

      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
        <span className="bk-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Health notes</span>
        <span style={{ color: gymnast.healthNotes === 'none' ? 'var(--booking-text-muted)' : 'inherit' }}>
          {gymnast.healthNotes === 'none'
            ? 'No known health issues or learning differences'
            : gymnast.healthNotes || <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
        </span>
      </div>

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

function MembershipPaymentForm({ membership, intentType, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const confirmFn = intentType === 'setup' ? stripe.confirmSetup : stripe.confirmPayment;
    const { error } = await confirmFn({
      elements,
      confirmParams: { return_url: `${window.location.origin}/booking/my-account` },
      redirect: 'if_required',
    });
    if (error) {
      setError(error.message);
      setProcessing(false);
    } else {
      setDone(true);
      onDone();
    }
  };

  if (done) return <p style={{ color: 'var(--booking-success)', fontSize: '0.875rem' }}>Payment submitted — your membership will activate shortly.</p>;

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <PaymentElement />
      {error && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={!stripe || processing} className="bk-btn bk-btn--primary" style={{ marginTop: '0.75rem', width: '100%' }}>
        {processing ? 'Processing...' : `Set up payment — £${(membership.monthlyAmount / 100).toFixed(2)}/month`}
      </button>
    </form>
  );
}

function MembershipCard({ membership, onUpdated }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [intentType, setIntentType] = useState('payment');
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [secretError, setSecretError] = useState(null);

  const loadClientSecret = async () => {
    setLoadingSecret(true);
    setSecretError(null);
    try {
      const res = await bookingApi.getMembershipClientSecret(membership.id);
      setClientSecret(res.data.clientSecret);
      setIntentType(res.data.intentType || 'payment');
    } catch (err) {
      setSecretError(err.response?.data?.error || 'Failed to load payment form. Please try again.');
    } finally {
      setLoadingSecret(false);
    }
  };

  const STATUS_DISPLAY = {
    PENDING_PAYMENT: { label: 'Payment setup required', color: 'var(--booking-danger)' },
    ACTIVE: { label: 'Active', color: 'var(--booking-success)' },
    PAUSED: { label: 'Paused', color: 'var(--booking-text-muted)' },
  };
  const s = STATUS_DISPLAY[membership.status] || { label: membership.status, color: 'inherit' };

  return (
    <div className="bk-card" style={{ marginBottom: '0.75rem' }}>
      <div className="bk-row bk-row--between" style={{ marginBottom: '0.5rem' }}>
        <strong>{membership.gymnast.firstName} {membership.gymnast.lastName}</strong>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: s.color }}>{s.label}</span>
      </div>
      <div style={{ fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', color: 'var(--booking-text-muted)' }}>
        <span>Monthly</span><span style={{ color: 'var(--booking-text-on-light)', fontWeight: 600 }}>£{(membership.monthlyAmount / 100).toFixed(2)}</span>
        <span>Start date</span><span style={{ color: 'var(--booking-text-on-light)' }}>{new Date(membership.startDate).toLocaleDateString('en-GB')}</span>
      </div>

      {membership.status === 'PENDING_PAYMENT' && !clientSecret && (
        <>
          <button
            className="bk-btn bk-btn--primary"
            style={{ marginTop: '0.75rem', width: '100%' }}
            disabled={loadingSecret}
            onClick={loadClientSecret}
          >
            {loadingSecret ? 'Loading...' : 'Set up payment'}
          </button>
          {secretError && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{secretError}</p>}
        </>
      )}

      {membership.status === 'PENDING_PAYMENT' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <MembershipPaymentForm membership={membership} intentType={intentType} onDone={onUpdated} />
        </Elements>
      )}

      {membership.status === 'PAUSED' && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
          Your membership is currently paused. Contact the club to resume.
        </p>
      )}

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--booking-border)', fontSize: '0.85rem', color: 'var(--booking-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'var(--booking-text-on-light)' }}>Your first payment</strong><br />
          Your first payment will be a pro-rated amount covering the remainder of the current month. From the 1st of next month you'll be charged the full monthly amount.
        </p>
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'var(--booking-text-on-light)' }}>How your fee is calculated</strong><br />
          Your monthly fee is based on a training year of 46 weeks, using the number of sessions per week we have agreed together. We divide the total annual cost by 12 to give you a consistent monthly payment — so you pay the same amount every month regardless of how many sessions fall in that particular month.
        </p>
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'var(--booking-text-on-light)' }}>Flexibility</strong><br />
          You have flexibility in how you use your sessions. If you normally train on a Tuesday but a Thursday works better one week, that's absolutely fine — just attend the session you need. As a member, you no longer need to sign up to individual sessions in advance.
        </p>
      </div>
    </div>
  );
}

export default function MyChildren() {
  const { user, updateUser } = useAuth();
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [credits, setCredits] = useState([]);
  const [memberships, setMemberships] = useState([]);

  const refreshUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`, { headers: getHeaders() });
      updateUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const load = () =>
    bookingApi.getBookableGymnasts()
      .then(r => setGymnasts(r.data))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    bookingApi.getMyCredits().then(r => setCredits(r.data)).catch(() => {});
    bookingApi.getMyMemberships().then(r => setMemberships(r.data)).catch(() => {});
  }, []);

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
    if (!form.healthNotesNone && !form.healthNotes.trim()) {
      setError('Please describe any health issues or learning differences, or confirm there are none.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        healthNotes: form.healthNotesNone ? 'none' : form.healthNotes.trim(),
      };
      await bookingApi.addChild(payload);
      setForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
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

      {user && <ContactDetailsSection user={user} onSaved={refreshUser} />}

      {credits.length > 0 && (
        <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Session credits</p>
          <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--booking-accent)' }}>
            £{(credits.reduce((s, c) => s + c.amount, 0) / 100).toFixed(2)} available
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {credits.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>£{(c.amount / 100).toFixed(2)}</span>
                <span className="bk-muted">Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {memberships.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h3>Memberships</h3>
          {memberships.map(m => (
            <MembershipCard key={m.id} membership={m} onUpdated={() =>
              bookingApi.getMyMemberships().then(r => setMemberships(r.data)).catch(() => {})
            } />
          ))}
        </section>
      )}

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
            <label className="bk-label">Date of birth
              <input type="date" className="bk-input" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} required style={{ marginTop: '0.25rem' }} />
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: '0.75rem 0 0' }}>
              <label className="bk-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.healthNotesNone}
                  onChange={e => setForm(f => ({ ...f, healthNotesNone: e.target.checked }))}
                  className="bk-checkbox"
                />
                No known health issues or learning differences
              </label>
              <label className="bk-label">Health issues or learning differences
                <textarea
                  className="bk-input"
                  value={form.healthNotes}
                  disabled={form.healthNotesNone}
                  onChange={e => setForm(f => ({ ...f, healthNotes: e.target.value }))}
                  rows={3}
                  placeholder="Describe any health conditions, learning differences, or anything coaches should know"
                  style={{ marginTop: '0.25rem', opacity: form.healthNotesNone ? 0.5 : 1 }}
                />
              </label>
            </fieldset>
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
