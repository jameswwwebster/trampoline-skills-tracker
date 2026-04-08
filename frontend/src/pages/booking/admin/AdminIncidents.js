import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const INCIDENT_TYPE_LABEL = {
  INJURY: 'Injury',
  NEAR_MISS: 'Near miss',
  ILLNESS: 'Illness',
  OTHER: 'Other',
};

const SEVERITY_LABEL = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  SEVERE: 'Severe',
};

const SEVERITY_COLOR = {
  MINOR: { background: 'rgba(39,174,96,0.12)', color: '#27ae60' },
  MODERATE: { background: 'rgba(230,126,34,0.12)', color: '#e67e22' },
  SEVERE: { background: 'rgba(192,57,43,0.12)', color: '#c0392b' },
};

const EMPTY_FORM = {
  gymnastId: '',
  incidentDate: '',
  location: '',
  incidentType: 'INJURY',
  severity: 'MINOR',
  description: '',
  injuryDetails: '',
  firstAidGiven: '',
  outcome: '',
  witnessName: '',
  witnessContact: '',
  witnessStatement: '',
};

function SeverityBadge({ severity }) {
  const style = SEVERITY_COLOR[severity] || {};
  return (
    <span style={{
      ...style,
      padding: '2px 10px',
      borderRadius: 99,
      fontSize: '0.78rem',
      fontWeight: 700,
      display: 'inline-block',
    }}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

function ForwardForm({ incidentId, onForwarded }) {
  const [form, setForm] = useState({ toEmail: '', toName: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.forwardIncident(incidentId, form);
      setForm({ toEmail: '', toName: '', note: '' });
      onForwarded();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to forward report.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <div className="bk-grid-2">
        <label className="bk-label" style={{ fontWeight: 'normal' }}>
          Recipient email *
          <input type="email" required className="bk-input" value={form.toEmail}
            onChange={e => setForm(f => ({ ...f, toEmail: e.target.value }))}
            placeholder="e.g. office@school.co.uk" style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label" style={{ fontWeight: 'normal' }}>
          Recipient name
          <input type="text" className="bk-input" value={form.toName}
            onChange={e => setForm(f => ({ ...f, toName: e.target.value }))}
            placeholder="e.g. School office" style={{ marginTop: '0.25rem' }} />
        </label>
      </div>
      <label className="bk-label" style={{ fontWeight: 'normal', marginTop: '0.5rem' }}>
        Note (optional)
        <input type="text" maxLength={300} className="bk-input" value={form.note}
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="Add a note for the recipient" style={{ marginTop: '0.25rem' }} />
      </label>
      {error && <p className="bk-error">{error}</p>}
      <div className="bk-row" style={{ marginTop: '0.75rem' }}>
        <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary bk-btn--sm">
          {submitting ? 'Sending...' : 'Send report'}
        </button>
      </div>
    </form>
  );
}

function IncidentDetail({ incident, gymnasts, onClose, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...incident });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showForwardForm, setShowForwardForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [current, setCurrent] = useState(incident);

  const reload = async () => {
    try {
      const res = await bookingApi.getIncident(incident.id);
      setCurrent(res.data);
    } catch { /* ignore */ }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await bookingApi.updateIncident(incident.id, {
        incidentDate: form.incidentDate,
        location: form.location,
        incidentType: form.incidentType,
        severity: form.severity,
        description: form.description,
        injuryDetails: form.injuryDetails,
        firstAidGiven: form.firstAidGiven,
        outcome: form.outcome,
        witnessName: form.witnessName,
        witnessContact: form.witnessContact,
        witnessStatement: form.witnessStatement,
      });
      setCurrent(res.data);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this incident report? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await bookingApi.deleteIncident(incident.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete.');
      setDeleting(false);
    }
  };

  const dateStr = new Date(current.incidentDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const gymnástName = current.gymnast
    ? `${current.gymnast.firstName} ${current.gymnast.lastName}`
    : 'Unknown';

  return (
    <div className="bk-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bk-modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Incident Report</h3>
            <p className="bk-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              {gymnástName} · {dateStr}
            </p>
          </div>
          <button className="bk-btn bk-btn--sm" onClick={onClose}
            style={{ border: '1px solid var(--booking-border)', marginLeft: '1rem', flexShrink: 0 }}>
            Close
          </button>
        </div>

        {error && <p className="bk-error">{error}</p>}

        {!editing ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Type</p>
                <p style={{ margin: 0 }}>{INCIDENT_TYPE_LABEL[current.incidentType] ?? current.incidentType}</p>
              </div>
              <div>
                <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Severity</p>
                <SeverityBadge severity={current.severity} />
              </div>
              {current.location && (
                <div>
                  <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Location</p>
                  <p style={{ margin: 0 }}>{current.location}</p>
                </div>
              )}
              <div>
                <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Reported by</p>
                <p style={{ margin: 0 }}>{current.reportedBy.firstName} {current.reportedBy.lastName}</p>
              </div>
            </div>

            <Section title="What happened">
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.description}</p>
            </Section>

            {current.injuryDetails && (
              <Section title="Injury / symptoms">
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.injuryDetails}</p>
              </Section>
            )}
            {current.firstAidGiven && (
              <Section title="First aid given">
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.firstAidGiven}</p>
              </Section>
            )}
            {current.outcome && (
              <Section title="Outcome">
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.outcome}</p>
              </Section>
            )}

            {(current.witnessName || current.witnessContact || current.witnessStatement) && (
              <Section title="Witness account">
                {current.witnessName && <p style={{ margin: '0 0 0.25rem' }}><strong>Name:</strong> {current.witnessName}</p>}
                {current.witnessContact && <p style={{ margin: '0 0 0.25rem' }}><strong>Contact:</strong> {current.witnessContact}</p>}
                {current.witnessStatement && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.witnessStatement}</p>}
              </Section>
            )}

            <div style={{ marginTop: '0.5rem', fontSize: '0.82rem' }} className="bk-muted">
              {current.adultNotifiedAt
                ? `Guardian/gymnast notified by email at ${new Date(current.adultNotifiedAt).toLocaleString('en-GB')}`
                : 'Guardian/gymnast email notification pending (sent 1 hour after filing)'}
            </div>

            {/* Forwarding history */}
            <Section title="Forwarded to">
              {current.forwards.length === 0 ? (
                <p className="bk-muted" style={{ margin: 0, fontSize: '0.88rem' }}>Not yet forwarded.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--booking-border)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600 }}>Recipient</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Sent by</th>
                      <th style={{ textAlign: 'left', padding: '4px 0 4px 8px', fontWeight: 600 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.forwards.map(fw => (
                      <tr key={fw.id} style={{ borderBottom: '1px solid var(--booking-border)' }}>
                        <td style={{ padding: '6px 8px 6px 0' }}>
                          {fw.toName ? `${fw.toName} ` : ''}<span className="bk-muted">{fw.toEmail}</span>
                          {fw.note && <div className="bk-muted" style={{ fontSize: '0.8rem' }}>{fw.note}</div>}
                        </td>
                        <td style={{ padding: '6px 8px' }}>{fw.forwardedBy.firstName} {fw.forwardedBy.lastName}</td>
                        <td style={{ padding: '6px 0 6px 8px' }}>{new Date(fw.sentAt).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <button className="bk-btn bk-btn--sm"
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => setShowForwardForm(v => !v)}>
                  {showForwardForm ? 'Cancel' : '+ Forward report'}
                </button>
              </div>
              {showForwardForm && (
                <ForwardForm incidentId={current.id} onForwarded={() => { reload(); setShowForwardForm(false); }} />
              )}
            </Section>

            <div className="bk-row" style={{ marginTop: '1.25rem' }}>
              <button className="bk-btn bk-btn--primary bk-btn--sm" onClick={() => { setForm({ ...current }); setEditing(true); }}>
                Edit report
              </button>
              <button className="bk-btn bk-btn--danger bk-btn--sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave}>
            <IncidentFormFields form={form} setForm={setForm} gymnasts={gymnasts} />
            <div className="bk-row" style={{ marginTop: '1.25rem' }}>
              <button type="submit" className="bk-btn bk-btn--primary bk-btn--sm" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" className="bk-btn bk-btn--sm"
                style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--booking-muted)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function IncidentFormFields({ form, setForm, gymnasts }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <>
      <div className="bk-grid-2">
        <label className="bk-label">
          Gymnast
          <select className="bk-input" value={form.gymnastId || ''} onChange={e => set('gymnastId', e.target.value)}
            style={{ marginTop: '0.25rem' }}>
            <option value="">— select gymnast —</option>
            {gymnasts.map(g => (
              <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
            ))}
          </select>
        </label>
        <label className="bk-label">
          Incident date &amp; time *
          <input type="datetime-local" className="bk-input" required value={form.incidentDate ? form.incidentDate.slice(0, 16) : ''}
            onChange={e => set('incidentDate', e.target.value)}
            style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label">
          Type *
          <select className="bk-input" required value={form.incidentType} onChange={e => set('incidentType', e.target.value)}
            style={{ marginTop: '0.25rem' }}>
            {Object.entries(INCIDENT_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="bk-label">
          Severity *
          <select className="bk-input" required value={form.severity} onChange={e => set('severity', e.target.value)}
            style={{ marginTop: '0.25rem' }}>
            {Object.entries(SEVERITY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        Location
        <input type="text" className="bk-input" value={form.location || ''} onChange={e => set('location', e.target.value)}
          placeholder="e.g. Main gym floor" style={{ marginTop: '0.25rem' }} />
      </label>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        Description — what happened *
        <textarea className="bk-input" required rows={4} value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Describe what happened in as much detail as possible" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
      </label>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        Injury / symptoms
        <textarea className="bk-input" rows={2} value={form.injuryDetails || ''} onChange={e => set('injuryDetails', e.target.value)}
          placeholder="Describe the nature of any injury or symptoms" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
      </label>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        First aid given
        <textarea className="bk-input" rows={2} value={form.firstAidGiven || ''} onChange={e => set('firstAidGiven', e.target.value)}
          placeholder="Detail any first aid that was administered" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
      </label>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        Outcome
        <textarea className="bk-input" rows={2} value={form.outcome || ''} onChange={e => set('outcome', e.target.value)}
          placeholder="e.g. Gymnast sent home, advised to see GP, ambulance called" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
      </label>
      <fieldset style={{ border: '1px solid var(--booking-border)', borderRadius: 8, padding: '0.75rem 1rem', marginTop: '0.75rem' }}>
        <legend style={{ fontWeight: 600, fontSize: '0.88rem', padding: '0 0.4rem' }}>Witness account</legend>
        <div className="bk-grid-2">
          <label className="bk-label" style={{ fontWeight: 'normal' }}>
            Witness name
            <input type="text" className="bk-input" value={form.witnessName || ''} onChange={e => set('witnessName', e.target.value)}
              style={{ marginTop: '0.25rem' }} />
          </label>
          <label className="bk-label" style={{ fontWeight: 'normal' }}>
            Witness contact
            <input type="text" className="bk-input" value={form.witnessContact || ''} onChange={e => set('witnessContact', e.target.value)}
              placeholder="Phone or email" style={{ marginTop: '0.25rem' }} />
          </label>
        </div>
        <label className="bk-label" style={{ fontWeight: 'normal', marginTop: '0.5rem' }}>
          Witness statement
          <textarea className="bk-input" rows={3} value={form.witnessStatement || ''} onChange={e => set('witnessStatement', e.target.value)}
            style={{ marginTop: '0.25rem', resize: 'vertical' }} />
        </label>
      </fieldset>
    </>
  );
}

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = () => {
    Promise.all([
      bookingApi.getIncidents(),
      bookingApi.getBookableGymnasts(),
    ]).then(([iRes, gRes]) => {
      setIncidents(iRes.data);
      setGymnasts(gRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await bookingApi.createIncident({
        ...form,
        incidentDate: new Date(form.incidentDate).toISOString(),
        gymnastId: form.gymnastId || undefined,
      });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create incident report.');
      setSubmitting(false);
    }
  };

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Incident Reports</h2>
        <button className="bk-btn bk-btn--primary bk-btn--sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New report'}
        </button>
      </div>

      {showForm && (
        <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>New Incident Report</h3>
          <form onSubmit={handleCreate}>
            <IncidentFormFields form={form} setForm={setForm} gymnasts={gymnasts} />
            {formError && <p className="bk-error" style={{ marginTop: '0.75rem' }}>{formError}</p>}
            <div className="bk-row" style={{ marginTop: '1.25rem' }}>
              <button type="submit" className="bk-btn bk-btn--primary bk-btn--sm" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save report'}
              </button>
              <button type="button" className="bk-btn bk-btn--sm"
                style={{ border: '1px solid var(--booking-border)' }}
                onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {incidents.length === 0 && !showForm && (
        <p className="bk-muted">No incident reports filed yet.</p>
      )}

      {incidents.map(inc => {
        const gymnástName = inc.gymnast
          ? `${inc.gymnast.firstName} ${inc.gymnast.lastName}`
          : 'Unknown gymnast';
        const dateStr = new Date(inc.incidentDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        return (
          <div key={inc.id} className="bk-card" style={{ cursor: 'pointer' }}
            onClick={() => setSelected(inc)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div>
                <strong>{gymnástName}</strong>
                <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.88rem' }}>{dateStr}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <SeverityBadge severity={inc.severity} />
                <span style={{ fontSize: '0.82rem', color: 'var(--booking-muted)' }}>
                  {INCIDENT_TYPE_LABEL[inc.incidentType] ?? inc.incidentType}
                </span>
              </div>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }} className="bk-muted">
              {inc.description.length > 120 ? inc.description.slice(0, 120) + '…' : inc.description}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }} className="bk-muted">
              Filed by {inc.reportedBy.firstName} {inc.reportedBy.lastName}
              {inc.forwards.length > 0 && ` · Forwarded to ${inc.forwards.length} recipient${inc.forwards.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        );
      })}

      {selected && (
        <IncidentDetail
          incident={selected}
          gymnasts={gymnasts}
          onClose={() => setSelected(null)}
          onSaved={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
