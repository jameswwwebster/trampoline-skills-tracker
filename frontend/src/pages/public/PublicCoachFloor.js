import React, { useState } from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';
import './PublicCoachFloor.css';

// Two Chloes in Saturday data — use initial to distinguish
const SATURDAY = [
  { name: 'Chloe N.',  club: 'apollo', event: 'DMT - 13-16 Female League 1', panel: 7, flight: 1, no: 3,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Emily',     club: 'apollo', event: 'DMT - 13-16 Female League 1', panel: 7, flight: 1, no: 7,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Harry',     club: 'apollo', event: 'DMT - 13-16 Male League 1',   panel: 7, flight: 1, no: 6,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Jaxson',    club: 'apollo', event: 'DMT - 9-12 Male League 1',    panel: 8, flight: 1, no: 1,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Hector',    club: 'apollo', event: 'DMT - 13-16 Male League 2',   panel: 8, flight: 1, no: 3,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Sennen',    club: 'apollo', event: 'DMT - 13-16 Male League 2',   panel: 8, flight: 1, no: 4,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Jonah',     club: 'apollo', event: 'DMT - 13-16 Male League 2',   panel: 8, flight: 1, no: 6,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Luke',      club: 'apollo', event: 'DMT - 13-16 Male League 2',   panel: 8, flight: 1, no: 8,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Danny',     club: 'tl',     event: 'DMT - 17+ Male League 1',     panel: 8, flight: 2, no: 9,  warmUp: '10:55 – 11:10', compete: '11:10 – 11:25' },
  { name: 'Abigail',   club: 'tl',     event: 'TRI - 13-14 Female League 3', panel: 1, flight: 2, no: 19, warmUp: '11:10 – 11:35', compete: '11:35 – 12:05' },
  { name: 'Leo',       club: 'tl',     event: 'DMT - 9+ Male Super League',  panel: 8, flight: 3, no: 2,  warmUp: '11:25 – 11:35', compete: '11:35 – 11:55' },
  { name: 'Danny',     club: 'tl',     event: 'DMT - 9+ Male Super League',  panel: 8, flight: 3, no: 14, warmUp: '11:25 – 11:35', compete: '11:35 – 11:55' },
  { name: 'Chloe N.',  club: 'apollo', event: 'DMT - 9+ Female Super League',panel: 7, flight: 3, no: 4,  warmUp: '11:25 – 11:35', compete: '11:35 – 11:55' },
  { name: 'Emily',     club: 'apollo', event: 'DMT - 9+ Female Super League',panel: 7, flight: 3, no: 15, warmUp: '11:25 – 11:35', compete: '11:35 – 11:55' },
  { name: 'Harry',     club: 'apollo', event: 'DMT - 9+ Male Super League',  panel: 8, flight: 3, no: 7,  warmUp: '11:25 – 11:35', compete: '11:35 – 11:55' },
  { name: 'Annabelle', club: 'apollo', event: 'DMT - 9-12 Female League 2',  panel: 7, flight: 5, no: 4,  warmUp: '11:55 – 12:30', compete: '12:30 – 12:45' },
  { name: 'Nancy',     club: 'apollo', event: 'DMT - 9-12 Female League 2',  panel: 7, flight: 5, no: 5,  warmUp: '11:55 – 12:30', compete: '12:30 – 12:45' },
  { name: 'Amelia',    club: 'apollo', event: 'DMT - 9-12 Female League 2',  panel: 7, flight: 5, no: 6,  warmUp: '11:55 – 12:30', compete: '12:30 – 12:45' },
  { name: 'Tristan',   club: 'apollo', event: 'DMT - 9-12 Male League 2',    panel: 8, flight: 5, no: 5,  warmUp: '11:55 – 12:30', compete: '12:30 – 12:45' },
  { name: 'Jayden',    club: 'apollo', event: 'DMT - 9-12 Male League 2',    panel: 8, flight: 5, no: 6,  warmUp: '11:55 – 12:30', compete: '12:30 – 12:45' },
  { name: 'Alex',      club: 'tl',     event: 'TRI - 19+ Male League 2',     panel: 3, flight: 4, no: 4,  warmUp: '13:45 – 14:15', compete: '14:15 – 14:50' },
  { name: 'Victoria',  club: 'tl',     event: 'TRI - 19+ Female League 3',   panel: 2, flight: 4, no: 14, warmUp: '14:10 – 14:40', compete: '14:40 – 15:25' },
  { name: 'Ben',       club: 'tl',     event: 'TRI - 13-14 Male League 3',   panel: 4, flight: 4, no: 12, warmUp: '14:40 – 15:10', compete: '15:10 – 15:55' },
  { name: 'Chloe T.',  club: 'apollo', event: 'DMT - 17+ Female League 2',   panel: 7, flight: 6, no: 6,  warmUp: '16:25 – 16:35', compete: '16:35 – 16:55' },
  { name: 'Lily',      club: 'apollo', event: 'DMT - 13-16 Female League 2', panel: 8, flight: 6, no: 5,  warmUp: '16:25 – 16:35', compete: '16:35 – 16:55' },
  { name: 'Annabel',   club: 'apollo', event: 'DMT - 13-16 Female League 2', panel: 8, flight: 7, no: 17, warmUp: '16:55 – 17:05', compete: '17:05 – 17:35' },
];

const SUNDAY = [
  { name: 'Millie',       club: 'tl',     event: 'DMT - 17+ Female League 3',        panel: 8, flight: 1, no: 10, warmUp: '09:00 – 09:20', compete: '09:20 – 09:50' },
  { name: 'Lois',         club: 'tl',     event: 'TRI - 19+ Female League 2',        panel: 5, flight: 3, no: 1,  warmUp: '12:05 – 12:35', compete: '12:35 – 13:10' },
  { name: 'Matthew',      club: 'tl',     event: 'TRI - 17+ Male League 1 (Senior)', panel: 3, flight: 3, no: 4,  warmUp: '12:05 – 12:45', compete: '12:45 – 13:35' },
  { name: 'Millie',       club: 'tl',     event: 'TRI - 19+ Female League 2',        panel: 5, flight: 4, no: 15, warmUp: '13:10 – 13:35', compete: '13:35 – 14:00' },
  { name: 'Abigail',      club: 'tl',     event: 'DMT - 13-14 Female League 3',      panel: 8, flight: 4, no: 4,  warmUp: '13:25 – 13:40', compete: '13:40 – 14:05' },
  { name: 'Olivia',       club: 'apollo', event: 'DMT - 13-14 Female League 3',      panel: 8, flight: 4, no: 3,  warmUp: '13:25 – 13:40', compete: '13:40 – 14:05' },
  { name: 'Matthew',      club: 'tl',     event: 'TRI - 9+ Male Super League',       panel: 3, flight: 4, no: 12, warmUp: '14:05 – 14:40', compete: '14:40 – 15:30' },
  { name: 'Jake',         club: 'apollo', event: 'DMT - 9-12 Male League 3',         panel: 8, flight: 6, no: 3,  warmUp: '14:35 – 14:50', compete: '14:50 – 15:10' },
  { name: 'Lois & Millie',club: 'tl',     event: 'TRS - 19+ Mixed Synchro',          panel: 2, flight: 6, no: 7,  warmUp: '16:35 – 17:05', compete: '17:05 – 17:35' },
];

function disciplineTag(event) {
  if (event.startsWith('TRS')) return <span className="cf-tag cf-tag--trs">TRS</span>;
  if (event.startsWith('DMT')) return <span className="cf-tag cf-tag--dmt">DMT</span>;
  return <span className="cf-tag cf-tag--tri">TRI</span>;
}

function ClubBadge({ club }) {
  return (
    <span className={`cf-club cf-club--${club}`}>
      {club === 'tl' ? 'TL' : 'Apollo'}
    </span>
  );
}

function Card({ r }) {
  const category = r.event.replace(/^(TRI|DMT|TRS) - /, '');
  return (
    <div className="cf-card">
      <div className="cf-card-top">
        <div className="cf-card-name-row">
          <ClubBadge club={r.club} />
          <span className="cf-card-name">{r.name}</span>
          {disciplineTag(r.event)}
        </div>
        <span className="cf-card-category">{category}</span>
      </div>
      <div className="cf-card-meta">
        <span>Panel <strong>{r.panel}</strong></span>
        <span className="cf-dot">·</span>
        <span>Flight <strong>{r.flight}</strong></span>
        <span className="cf-dot">·</span>
        <span>No. <strong>{r.no}</strong></span>
      </div>
      <div className="cf-card-times">
        <div className="cf-time-block">
          <span className="cf-time-label">Warm-up</span>
          <span className="cf-time-value">{r.warmUp}</span>
        </div>
        <div className="cf-time-block cf-time-block--compete">
          <span className="cf-time-label">Compete</span>
          <span className="cf-time-value">{r.compete}</span>
        </div>
      </div>
    </div>
  );
}

function TableRow({ r }) {
  const category = r.event.replace(/^(TRI|DMT|TRS) - /, '');
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ClubBadge club={r.club} />
          <span className="cf-name">{r.name}</span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {disciplineTag(r.event)}
          <span style={{ color: '#444' }}>{category}</span>
        </div>
      </td>
      <td className="cf-center">{r.panel}</td>
      <td className="cf-center">{r.flight}</td>
      <td className="cf-center">{r.no}</td>
      <td className="cf-nowrap">{r.warmUp}</td>
      <td className="cf-nowrap cf-compete-time">{r.compete}</td>
    </tr>
  );
}

export default function PublicCoachFloor() {
  const [day, setDay] = useState('saturday');
  const rows = day === 'saturday' ? SATURDAY : SUNDAY;
  const dateLabel = day === 'saturday' ? 'Saturday 21 March 2026' : 'Sunday 22 March 2026';

  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main">

        <section className="cf-hero">
          <div className="cf-hero-inner">
            <p className="cf-hero-label">Coach Floor Guide</p>
            <h1 className="cf-hero-title">Trampoline League 2025</h1>
          </div>
        </section>

        <section className="cf-section">
          <div className="cf-inner">

            <div className="cf-tabs" role="tablist">
              <button
                className={`cf-tab${day === 'saturday' ? ' cf-tab--active' : ''}`}
                onClick={() => setDay('saturday')}
                role="tab"
                aria-selected={day === 'saturday'}
              >
                Saturday
              </button>
              <button
                className={`cf-tab${day === 'sunday' ? ' cf-tab--active' : ''}`}
                onClick={() => setDay('sunday')}
                role="tab"
                aria-selected={day === 'sunday'}
              >
                Sunday
              </button>
            </div>

            <p className="cf-date">{dateLabel}</p>

            {/* Mobile cards */}
            <div className="cf-cards">
              {rows.map((r, i) => <Card key={i} r={r} />)}
            </div>

            {/* Desktop table */}
            <div className="cf-table-wrap">
              <table className="cf-table">
                <thead>
                  <tr>
                    <th>Competitor</th>
                    <th>Event</th>
                    <th>Panel</th>
                    <th>Flight</th>
                    <th>No.</th>
                    <th>Warm-Up</th>
                    <th>Compete</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => <TableRow key={i} r={r} />)}
                </tbody>
              </table>
            </div>

          </div>
        </section>

      </main>
      <PublicFooter />
    </div>
  );
}
