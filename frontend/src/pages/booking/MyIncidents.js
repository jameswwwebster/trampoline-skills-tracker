import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

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

function IncidentDetailModal({ incident, onClose }) {
  const dateStr = new Date(incident.incidentDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const gymnástName = incident.gymnast
    ? `${incident.gymnast.firstName} ${incident.gymnast.lastName}`
    : 'Unknown';

  return (
    <div className="bk-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bk-modal" style={{ maxWidth: 560 }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Type</p>
            <p style={{ margin: 0 }}>{INCIDENT_TYPE_LABEL[incident.incidentType] ?? incident.incidentType}</p>
          </div>
          <div>
            <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Severity</p>
            <SeverityBadge severity={incident.severity} />
          </div>
          {incident.location && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p className="bk-muted" style={{ margin: 0, fontSize: '0.78rem' }}>Location</p>
              <p style={{ margin: 0 }}>{incident.location}</p>
            </div>
          )}
        </div>

        <Section title="What happened">
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{incident.description}</p>
        </Section>
        {incident.injuryDetails && (
          <Section title="Injury / symptoms">
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{incident.injuryDetails}</p>
          </Section>
        )}
        {incident.firstAidGiven && (
          <Section title="First aid given">
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{incident.firstAidGiven}</p>
          </Section>
        )}
        {incident.outcome && (
          <Section title="Outcome">
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{incident.outcome}</p>
          </Section>
        )}

        <p className="bk-muted" style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
          Filed by {incident.reportedBy.firstName} {incident.reportedBy.lastName}
          {' · '}
          {incident.adultNotifiedAt
            ? `You were emailed on ${new Date(incident.adultNotifiedAt).toLocaleDateString('en-GB')}`
            : 'Email notification pending'}
        </p>
      </div>
    </div>
  );
}

export default function MyIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    bookingApi.getMyIncidents()
      .then(res => setIncidents(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <h2>Incident Reports</h2>
      {incidents.length === 0 ? (
        <p className="bk-muted">No incident reports on file.</p>
      ) : (
        incidents.map(inc => {
          const gymnástName = inc.gymnast
            ? `${inc.gymnast.firstName} ${inc.gymnast.lastName}`
            : 'Unknown';
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
            </div>
          );
        })
      )}

      {selected && (
        <IncidentDetailModal incident={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
