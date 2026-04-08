import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const CONCERN_TYPE_LABEL = {
  SAFEGUARDING: 'Safeguarding',
  BULLYING: 'Bullying',
  EMOTIONAL: 'Emotional',
  PHYSICAL: 'Physical',
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
  concernType: 'SAFEGUARDING',
  severity: 'MINOR',
  description: '',
  actionTaken: '',
  outcome: '',
  witnessName: '',
  witnessContact: '',
  witnessStatement: '',
  referredExternally: false,
  referralDetails: '',
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

function WelfareFormFields({ form, setForm, gymnasts }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <>
      <div className="bk-grid-2">
        <label className="bk-label">
          Person involved
          <select className="bk-input" value={form.gymnastId || ''} onChange={e => set('gymnastId', e.target.value)}
            style={{ marginTop: '0.25rem' }}>
            <option value="">— select gymnast —</option>
            {gymnasts.map(g => (
              <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
            ))}
          </select>
        </label>
        <label className="bk-label">
          Date &amp; time *
          <input type="datetime-local" className="bk-input" required value={form.incidentDate ? form.incidentDate.slice(0, 16) : ''}
            onChange={e => set('incidentDate', e.target.value)}
            style={{ marginTop: '0.25rem' }} />
        </label>
        <label className="bk-label">
          Concern type *
          <select className="bk-input" required value={form.concernType} onChange={e => set('concernType', e.target.value)}
            style={{ marginTop: '0.25rem' }}>
            {Object.entries(CONCERN_TYPE_LABEL).map(([v, l]) => (
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
        Description — what was observed / reported *
        <textarea className="bk-input" required rows={4} value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Describe the concern in as much detail as possible" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
      </label>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        Action taken
        <textarea className="bk-input" rows={2} value={form.actionTaken || ''} onChange={e => set('actionTaken', e.target.value)}
          placeholder="What action was taken in response" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
      </label>
      <label className="bk-label" style={{ marginTop: '0.5rem' }}>
        Outcome
        <textarea className="bk-input" rows={2} value={form.outcome || ''} onChange={e => set('outcome', e.target.value)}
          placeholder="What was the outcome or next steps" style={{ marginTop: '0.25rem', resize: 'vertical' }} />
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
      <fieldset style={{ border: '1px solid var(--booking-border)', borderRadius: 8, padding: '0.75rem 1rem', marginTop: '0.75rem' }}>
        <legend style={{ fontWeight: 600, fontSize: '0.88rem', padding: '0 0.4rem' }}>External referral</legend>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.referredExternally || false}
            onChange={e => set('referredExternally', e.target.checked)} />
          Referred to an external agency (e.g. social services, safeguarding lead)
        </label>
        {form.referredExternally && (
          <label className="bk-label" style={{ fontWeight: 'normal', marginTop: '0.75rem' }}>
            Referral details
            <textarea className="bk-input" rows={2} value={form.referralDetails || ''} onChange={e => set('referralDetails', e.target.value)}
              placeholder="Who was contacted, reference numbers, etc." style={{ marginTop: '0.25rem', resize: 'vertical' }} />
          </label>
        )}
      </fieldset>
    </>
  );
}

function WelfareDetail({ report, gymnasts, onClose, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...report });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [current, setCurrent] = useState(report);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await bookingApi.updateWelfareReport(report.id, {
        incidentDate: form.incidentDate,
        location: form.location,
        concernType: form.concernType,
        severity: form.severity,
        description: form.description,
        actionTaken: form.actionTaken,
        outcome: form.outcome,
        witnessName: form.witnessName,
        witnessContact: form.witnessContact,
        witnessStatement: form.witnessStatement,
        referredExternally: form.referredExternally,
        referralDetails: form.referralDetails,
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
    if (!window.confirm('Delete this welfare report? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await bookingApi.deleteWelfareReport(report.id);
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
            <h3 style={{ margin: 0 }}>Welfare Report</h3>
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
                <p style={{ margin: 0 }}>{CONCERN_TYPE_LABEL[current.concernType] ?? current.concernType}</p>
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
                <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Filed by</p>
                <p style={{ margin: 0 }}>{current.reportedBy.firstName} {current.reportedBy.lastName}</p>
              </div>
            </div>

            <Section title="Description">
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.description}</p>
            </Section>
            {current.actionTaken && (
              <Section title="Action taken">
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.actionTaken}</p>
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
            {(current.referredExternally || current.referralDetails) && (
              <Section title="External referral">
                <p style={{ margin: 0 }}>
                  {current.referredExternally ? 'Referred to external agency.' : 'Not referred externally.'}
                </p>
                {current.referralDetails && <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{current.referralDetails}</p>}
              </Section>
            )}

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
            <WelfareFormFields form={form} setForm={setForm} gymnasts={gymnasts} />
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

export default function AdminWelfare() {
  const [reports, setReports] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = () => {
    Promise.all([
      bookingApi.getWelfareReports(),
      bookingApi.getBookableGymnasts(),
    ]).then(([rRes, gRes]) => {
      setReports(rRes.data);
      setGymnasts(gRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await bookingApi.createWelfareReport({
        ...form,
        incidentDate: new Date(form.incidentDate).toISOString(),
        gymnastId: form.gymnastId || undefined,
      });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create welfare report.');
      setSubmitting(false);
    }
  };

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Welfare Reports</h2>
        <button className="bk-btn bk-btn--primary bk-btn--sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New report'}
        </button>
      </div>
      <p className="bk-muted" style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '0.88rem' }}>
        Welfare reports are confidential and only visible to club administrators and welfare officers.
      </p>

      {showForm && (
        <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>New Welfare Report</h3>
          <form onSubmit={handleCreate}>
            <WelfareFormFields form={form} setForm={setForm} gymnasts={gymnasts} />
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

      {reports.length === 0 && !showForm && (
        <p className="bk-muted">No welfare reports on file.</p>
      )}

      {reports.map(r => {
        const gymnástName = r.gymnast
          ? `${r.gymnast.firstName} ${r.gymnast.lastName}`
          : 'Unknown';
        const dateStr = new Date(r.incidentDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        return (
          <div key={r.id} className="bk-card" style={{ cursor: 'pointer' }}
            onClick={() => setSelected(r)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div>
                <strong>{gymnástName}</strong>
                <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.88rem' }}>{dateStr}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <SeverityBadge severity={r.severity} />
                <span style={{ fontSize: '0.82rem', color: 'var(--booking-muted)' }}>
                  {CONCERN_TYPE_LABEL[r.concernType] ?? r.concernType}
                </span>
                {r.referredExternally && (
                  <span style={{ fontSize: '0.78rem', background: 'rgba(52,73,94,0.1)', color: '#34495e', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                    Referred
                  </span>
                )}
              </div>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }} className="bk-muted">
              {r.description.length > 120 ? r.description.slice(0, 120) + '…' : r.description}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }} className="bk-muted">
              Filed by {r.reportedBy.firstName} {r.reportedBy.lastName}
            </p>
          </div>
        );
      })}

      {selected && (
        <WelfareDetail
          report={selected}
          gymnasts={gymnasts}
          onClose={() => setSelected(null)}
          onSaved={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
