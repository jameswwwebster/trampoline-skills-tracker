import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
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
  const [editingHealthNotes, setEditingHealthNotes] = useState(false);
  const [healthNotesValue, setHealthNotesValue] = useState(gymnast.healthNotes === 'none' ? '' : gymnast.healthNotes || '');
  const [healthNotesNone, setHealthNotesNone] = useState(gymnast.healthNotes === 'none');
  const [healthNotesSaving, setHealthNotesSaving] = useState(false);
  const [healthNotesError, setHealthNotesError] = useState(null);

  const handleSaveHealthNotes = async () => {
    setHealthNotesSaving(true);
    setHealthNotesError(null);
    try {
      const healthNotes = healthNotesNone ? 'none' : healthNotesValue || null;
      await bookingApi.updateHealthNotes(gymnast.id, { healthNotes });
      setEditingHealthNotes(false);
      onUpdated();
    } catch (err) {
      setHealthNotesError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setHealthNotesSaving(false);
    }
  };

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
        {editingHealthNotes ? (
          <div style={{ marginTop: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
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
                style={{ width: '100%', marginBottom: '0.4rem', fontSize: '0.875rem' }}
                value={healthNotesValue}
                onChange={e => setHealthNotesValue(e.target.value)}
                placeholder="Describe any health issues or learning differences"
              />
            )}
            {healthNotesError && <p className="bk-error">{healthNotesError}</p>}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className="bk-btn bk-btn--primary bk-btn--sm"
                disabled={healthNotesSaving}
                onClick={handleSaveHealthNotes}
              >
                {healthNotesSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                className="bk-btn bk-btn--sm"
                style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => {
                  setEditingHealthNotes(false);
                  setHealthNotesValue(gymnast.healthNotes === 'none' ? '' : gymnast.healthNotes || '');
                  setHealthNotesNone(gymnast.healthNotes === 'none');
                  setHealthNotesError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span style={{ color: gymnast.healthNotes === 'none' ? 'var(--booking-text-muted)' : 'inherit' }}>
              {gymnast.healthNotes === 'none'
                ? 'No known health issues or learning differences'
                : gymnast.healthNotes || <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
            </span>
            <button
              className="bk-btn bk-btn--sm"
              style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)', flexShrink: 0 }}
              onClick={() => {
                setHealthNotesValue(gymnast.healthNotes === 'none' ? '' : gymnast.healthNotes || '');
                setHealthNotesNone(gymnast.healthNotes === 'none');
                setEditingHealthNotes(true);
              }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <ConsentToggles gymnast={gymnast} onUpdated={onUpdated} />

      <BgNumberSection gymnast={gymnast} onUpdated={onUpdated} />
    </div>
  );
}

function BgNumberSection({ gymnast, onUpdated }) {
  const [input, setInput] = useState(gymnast.bgNumber || '');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  const isInvalid = gymnast.bgNumberStatus === 'INVALID';
  const hasNumber = !!gymnast.bgNumber;
  const needs = gymnast.pastSessionCount >= 2 && !hasNumber;

  const handleSave = async () => {
    if (!input.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await bookingApi.setBgNumber(gymnast.id, input.trim());
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const guidance = (
    <div style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
      <p style={{ margin: '0 0 0.4rem' }}>
        British Gymnastics membership provides <strong>personal accident insurance</strong> for all participants. It's required for everyone who trains with us.
      </p>
      <p style={{ margin: '0 0 0.4rem' }}>
        Start with <strong>Community</strong> membership at{' '}
        <a href="https://www.british-gymnastics.org/memberships" target="_blank" rel="noreferrer" style={{ color: 'var(--booking-accent)' }}>
          british-gymnastics.org/memberships
        </a>.
        Upgrade to <strong>Competitive</strong> for regional competitions or <strong>National</strong> for national competitions.
      </p>
      <p style={{ margin: 0 }}>
        If you already have BG membership with another club, you don't need to purchase it again — just log in to <a href="https://mybg.british-gymnastics.org/" target="_blank" rel="noreferrer">British Gymnastics</a> and add <strong>Trampoline Life</strong> as a club so we can see your membership from our end.
      </p>
    </div>
  );

  const inputRow = (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
      <input
        className="bk-input"
        style={{ flex: 1, minWidth: 0 }}
        placeholder="BG membership number"
        value={input}
        onChange={e => setInput(e.target.value)}
      />
      <button
        className="bk-btn bk-btn--primary bk-btn--sm"
        disabled={saving || !input.trim()}
        onClick={handleSave}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {editing && (
        <button
          className="bk-btn bk-btn--sm"
          style={{ border: '1px solid var(--booking-border)' }}
          onClick={() => { setEditing(false); setInput(gymnast.bgNumber || ''); setError(null); }}
        >
          Cancel
        </button>
      )}
    </div>
  );

  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--booking-border)' }}>
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>British Gymnastics Membership</p>

      {isInvalid && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--booking-danger)' }}>
          Your BG number couldn't be confirmed. Please check it was entered correctly and make sure you've added Trampoline Life as a club on <a href="https://mybg.british-gymnastics.org/" target="_blank" rel="noreferrer">British Gymnastics</a>.
        </div>
      )}

      {!hasNumber || isInvalid || editing ? (
        <>
          {needs && !isInvalid && (
            <p style={{ fontSize: '0.875rem', color: 'var(--booking-danger)', margin: '0 0 0.4rem' }}>
              {gymnast.firstName} has attended 2 sessions and now requires a BG membership number to continue booking.
            </p>
          )}
          {guidance}
          {inputRow}
          {error && <p style={{ fontSize: '0.8rem', color: 'var(--booking-danger)', marginTop: '0.3rem' }}>{error}</p>}
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            <span style={{ fontFamily: 'monospace' }}>{gymnast.bgNumber}</span>{' '}
            <button
              onClick={() => setEditing(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.78rem', padding: 0 }}
            >
              Update
            </button>
          </p>
          {gymnast.pastSessionCount < 2 && guidance}
        </>
      )}
    </div>
  );
}

function SetupPaymentMethodForm({ membershipId, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/booking/my-account` },
      redirect: 'if_required',
    });
    if (confirmError) {
      setError(confirmError.message);
      setProcessing(false);
      return;
    }
    try {
      await bookingApi.confirmMembershipPaymentMethod(membershipId, setupIntent.payment_method);
      onDone();
    } catch (err) {
      setError('Card saved but failed to update membership. Please contact the club.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <PaymentElement />
      {error && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={!stripe || processing} className="bk-btn bk-btn--primary" style={{ marginTop: '0.75rem', width: '100%' }}>
        {processing ? 'Processing...' : 'Save payment method'}
      </button>
    </form>
  );
}

function MembershipCard({ membership }) {
  const [hostedUrl, setHostedUrl] = useState(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [secretError, setSecretError] = useState(null);

  const loadPaymentLink = async () => {
    setLoadingSecret(true);
    setSecretError(null);
    try {
      const res = await bookingApi.getMembershipClientSecret(membership.id);
      setHostedUrl(res.data.hostedUrl);
    } catch (err) {
      setSecretError(err.response?.data?.error || 'Failed to load payment link. Please try again.');
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

  const firstMonthAmount = (() => {
    const start = new Date(membership.startDate);
    const year = start.getFullYear();
    const month = start.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysRemaining = daysInMonth - start.getDate() + 1;
    return Math.round((daysRemaining / daysInMonth) * membership.monthlyAmount);
  })();
  const startDate = new Date(membership.startDate);
  const firstOfNextMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);

  return (
    <div className="bk-card" style={{ marginBottom: '0.75rem' }}>
      <div className="bk-row bk-row--between" style={{ marginBottom: '0.5rem' }}>
        <strong>{membership.gymnast.firstName} {membership.gymnast.lastName}</strong>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: s.color }}>{s.label}</span>
      </div>
      <div style={{ fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', color: 'var(--booking-text-muted)' }}>
        <span>Monthly (from {firstOfNextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })})</span>
        <span style={{ color: 'var(--booking-text-on-light)', fontWeight: 600 }}>£{(membership.monthlyAmount / 100).toFixed(2)}</span>
        <span>Start date</span><span style={{ color: 'var(--booking-text-on-light)' }}>{startDate.toLocaleDateString('en-GB')}</span>
      </div>

      {membership.status === 'PENDING_PAYMENT' && (
        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: 'var(--booking-bg-light)', borderRadius: 'var(--booking-radius)', fontSize: '0.85rem' }}>
          <strong style={{ color: 'var(--booking-text-on-light)' }}>First payment: £{(firstMonthAmount / 100).toFixed(2)}</strong>
          <span style={{ color: 'var(--booking-text-muted)' }}> — covering the rest of {startDate.toLocaleDateString('en-GB', { month: 'long' })} (pro-rated). From {firstOfNextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} you'll be charged £{(membership.monthlyAmount / 100).toFixed(2)}/month.</span>
        </div>
      )}

      {membership.status === 'PENDING_PAYMENT' && !hostedUrl && (
        <>
          <button
            className="bk-btn bk-btn--primary"
            style={{ marginTop: '0.75rem', width: '100%' }}
            disabled={loadingSecret}
            onClick={loadPaymentLink}
          >
            {loadingSecret ? 'Loading...' : 'Set up payment'}
          </button>
          {secretError && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{secretError}</p>}
        </>
      )}

      {membership.status === 'PENDING_PAYMENT' && hostedUrl && (
        <div style={{ marginTop: '0.75rem' }}>
          <a
            href={hostedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bk-btn bk-btn--primary"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            Complete payment on Stripe →
          </a>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--booking-text-muted)', textAlign: 'center' }}>
            Opens in a new tab. Return here and refresh once payment is complete.
          </p>
        </div>
      )}

      {membership.status === 'PAUSED' && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
          Your membership is currently paused. Contact the club to resume.
        </p>
      )}
    </div>
  );
}

function NotificationPreferences({ user, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const toggle = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const newValue = user.weeklySessionReminder === false;
    try {
      const res = await axios.put(
        `${API_URL}/users/profile`,
        { weeklySessionReminder: newValue },
        { headers: getHeaders() }
      );
      onSaved(res.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3>Notifications</h3>
      <div className="bk-card">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={user?.weeklySessionReminder !== false}
            onChange={toggle}
            disabled={saving}
          />
          <span>
            <strong>Weekly session reminder</strong>
            <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginTop: '0.1rem' }}>
              Receive a Monday morning email showing available sessions for the week.
            </span>
          </span>
        </label>
        {saved && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--booking-success)' }}>Saved</p>}
        {saveError && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--booking-danger)' }}>{saveError}</p>}
      </div>
    </section>
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
  const [showSelfForm, setShowSelfForm] = useState(false);
  const [selfDob, setSelfDob] = useState('');
  const [credits, setCredits] = useState([]);
  const [charges, setCharges] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [setupClientSecret, setSetupClientSecret] = useState(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [setupError, setSetupError] = useState(null);

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
    bookingApi.getMyCharges().then(r => setCharges(r.data)).catch(() => {});
    bookingApi.getMyMemberships().then(r => setMemberships(r.data)).catch(() => {});
  }, []);

  const handleSelf = async (e) => {
    e.preventDefault();
    if (!selfDob) return;
    setError(null);
    try {
      await bookingApi.createSelfGymnast({ dateOfBirth: selfDob });
      setShowSelfForm(false);
      setSelfDob('');
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

  const refreshMemberships = () =>
    bookingApi.getMyMemberships().then(r => setMemberships(r.data)).catch(() => {});

  const membershipsNeedingPayment = memberships.filter(m => m.needsPaymentMethod);

  const loadSetupIntent = async () => {
    if (membershipsNeedingPayment.length === 0) return;
    setLoadingSetup(true);
    setSetupError(null);
    try {
      const res = await bookingApi.getMembershipSetupIntent(membershipsNeedingPayment[0].id);
      setSetupClientSecret(res.data.clientSecret);
    } catch (err) {
      setSetupError(err.response?.data?.error || 'Failed to load. Please try again.');
    } finally {
      setLoadingSetup(false);
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
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Session credits</p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>Applied automatically when you book a session.</p>
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

      {charges.length > 0 && (
        <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Outstanding charges</p>
          <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--booking-danger)' }}>
            £{(charges.reduce((s, c) => s + c.amount, 0) / 100).toFixed(2)} outstanding
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {charges.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{c.description}</span>
                <span className="bk-muted">Due {new Date(c.dueDate).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
          <Link
            to="/booking/cart"
            className="bk-btn bk-btn--primary"
            style={{ display: 'inline-block', marginTop: '0.75rem' }}
          >
            Pay now →
          </Link>
        </div>
      )}

      {memberships.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h3>Memberships</h3>

          {membershipsNeedingPayment.length > 0 && (
            <div className="bk-card" style={{ marginBottom: '0.75rem', borderLeft: '3px solid var(--booking-danger)' }}>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Payment method needed</p>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--booking-text-muted)' }}>
                {membershipsNeedingPayment.length === 1
                  ? `${membershipsNeedingPayment[0].gymnast.firstName}'s first payment was covered by credits. Add a card to ensure future monthly payments go through.`
                  : `${membershipsNeedingPayment.map(m => m.gymnast.firstName).join(' and ')}'s first payments were covered by credits. Add a card once to cover all memberships.`
                }
              </p>
              {!setupClientSecret ? (
                <>
                  <button
                    className="bk-btn bk-btn--primary"
                    onClick={loadSetupIntent}
                    disabled={loadingSetup}
                  >
                    {loadingSetup ? 'Loading...' : 'Add payment method'}
                  </button>
                  {setupError && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{setupError}</p>}
                </>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                  <SetupPaymentMethodForm
                    membershipId={membershipsNeedingPayment[0].id}
                    onDone={() => { setSetupClientSecret(null); refreshMemberships(); }}
                  />
                </Elements>
              )}
            </div>
          )}

          {memberships.map(m => (
            <MembershipCard key={m.id} membership={m} />
          ))}

          <div className="bk-card" style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--booking-text-on-light)' }}>How fees are calculated</strong><br />
              Monthly fees are based on a training year of 46 weeks. We divide the total annual cost by 12 to give a consistent monthly payment — so you pay the same amount every month regardless of how many sessions fall in that particular month.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--booking-text-on-light)' }}>Commitments</strong><br />
              Your membership is tied to a specific session or sessions each week. Please attend your committed session — if you need to change which session you train at, speak to your coach.
            </p>
          </div>
        </section>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h3>Myself</h3>
        {hasSelf ? (
          gymnasts.filter(g => g.isSelf).map(g => (
            <GymnastCard key={g.id} gymnast={g} onUpdated={load} />
          ))
        ) : showSelfForm ? (
          <form onSubmit={handleSelf} className="bk-form-card">
            <label className="bk-label">Date of birth
              <input type="date" className="bk-input" value={selfDob}
                onChange={e => setSelfDob(e.target.value)}
                required style={{ marginTop: '0.25rem' }} />
            </label>
            <div className="bk-row" style={{ marginTop: '0.75rem' }}>
              <button type="submit" className="bk-btn bk-btn--primary" disabled={!selfDob}>Confirm</button>
              <button type="button" className="bk-btn" style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => { setShowSelfForm(false); setSelfDob(''); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div>
            <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
              Add yourself to book sessions under your own name.
            </p>
            <button className="bk-btn bk-btn--primary" onClick={() => setShowSelfForm(true)}>
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

      <NotificationPreferences user={user} onSaved={updateUser} />
    </div>
  );
}
