import React, { useState } from 'react';
import changelog from '../../../data/changelog.js';

const INITIAL_SHOW = 3;

const TYPE_LABEL = { feature: 'New', improvement: 'Improved', fix: 'Fixed' };
const TYPE_STYLE = {
  feature: { background: 'rgba(41,128,185,0.12)', color: 'var(--booking-accent)', border: '1px solid rgba(41,128,185,0.25)' },
  improvement: { background: 'rgba(26,188,156,0.1)', color: '#0e9e82', border: '1px solid rgba(26,188,156,0.25)' },
  fix: { background: 'rgba(0,0,0,0.05)', color: 'var(--booking-text-muted)', border: '1px solid var(--booking-border)' },
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ChangelogPanel() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? changelog : changelog.slice(0, INITIAL_SHOW);

  return (
    <div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--booking-text)' }}>
        Recent updates
      </h3>
      {visible.map(release => (
        <div key={release.date} style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--booking-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {formatDate(release.date)}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {release.entries.map((entry) => (
              <li key={entry.text} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--booking-text)' }}>
                <span style={{
                  flexShrink: 0,
                  fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                  ...TYPE_STYLE[entry.type],
                }}>
                  {TYPE_LABEL[entry.type]}
                </span>
                {entry.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {changelog.length > INITIAL_SHOW && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', color: 'var(--booking-accent)', fontWeight: 600, padding: 0,
          }}
        >
          {showAll ? 'Show less' : `Show older (${changelog.length - INITIAL_SHOW} more)`}
        </button>
      )}
    </div>
  );
}
