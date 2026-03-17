import React, { useState } from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';
import './PublicTimetable.css';

const SATURDAY = [
  { competitor: 'Danny',    event: 'DMT - 17+ Male League 1',          panel: 8,  flight: 2, no: 9,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { competitor: 'Leo',      event: 'DMT - 9+ Male Super League',        panel: 8,  flight: 3, no: 2,  warmUp: '10:55 – 11:10', compete: '11:10 – 11:25' },
  { competitor: 'Danny',    event: 'DMT - 9+ Male Super League',        panel: 8,  flight: 3, no: 14, warmUp: '10:55 – 11:10', compete: '11:10 – 11:25' },
  { competitor: 'Abigail',  event: 'TRI - 13-14 Female League 3',       panel: 1,  flight: 2, no: 19, warmUp: '11:10 – 11:35', compete: '11:35 – 12:05' },
  { competitor: 'Alex',     event: 'TRI - 19+ Male League 2',           panel: 3,  flight: 4, no: 4,  warmUp: '13:45 – 14:15', compete: '14:15 – 14:50' },
  { competitor: 'Victoria', event: 'TRI - 19+ Female League 3',         panel: 2,  flight: 4, no: 14, warmUp: '14:10 – 14:40', compete: '14:40 – 15:25' },
  { competitor: 'Ben',      event: 'TRI - 13-14 Male League 3',         panel: 4,  flight: 4, no: 12, warmUp: '14:40 – 15:10', compete: '15:10 – 15:55' },
];

const SUNDAY = [
  { competitor: 'Millie',        event: 'DMT - 17+ Female League 3',         panel: 8,  flight: 1, no: 10, warmUp: '09:00 – 09:20', compete: '09:20 – 09:50' },
  { competitor: 'Lois',          event: 'TRI - 19+ Female League 2',         panel: 5,  flight: 3, no: 1,  warmUp: '12:05 – 12:35', compete: '12:35 – 13:10' },
  { competitor: 'Matthew',       event: 'TRI - 17+ Male League 1 (Senior)',  panel: 3,  flight: 3, no: 4,  warmUp: '12:05 – 12:45', compete: '12:45 – 13:35' },
  { competitor: 'Millie',        event: 'TRI - 19+ Female League 2',         panel: 5,  flight: 4, no: 15, warmUp: '13:10 – 13:35', compete: '13:35 – 14:00' },
  { competitor: 'Abigail',       event: 'DMT - 13-14 Female League 3',       panel: 8,  flight: 4, no: 4,  warmUp: '13:25 – 13:40', compete: '13:40 – 14:05' },
  { competitor: 'Matthew',       event: 'TRI - 9+ Male Super League',        panel: 3,  flight: 4, no: 12, warmUp: '14:05 – 14:40', compete: '14:40 – 15:30' },
  { competitor: 'Lois & Millie', event: 'TRS - 19+ Mixed Synchro',           panel: 2,  flight: 6, no: 7,  warmUp: '16:35 – 17:05', compete: '17:05 – 17:35' },
];

function disciplineTag(event) {
  if (event.startsWith('TRS')) return <span className="tt-tag tt-tag--trs">TRS</span>;
  if (event.startsWith('DMT')) return <span className="tt-tag tt-tag--dmt">DMT</span>;
  return <span className="tt-tag tt-tag--tri">TRI</span>;
}

function TimetableTable({ rows }) {
  return (
    <div className="tt-scroll">
      <table className="tt-table">
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
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="tt-competitor">{r.competitor}</td>
              <td className="tt-event">
                {disciplineTag(r.event)}
                <span className="tt-event-name">{r.event.replace(/^(TRI|DMT|TRS) - /, '')}</span>
              </td>
              <td className="tt-center">{r.panel}</td>
              <td className="tt-center">{r.flight}</td>
              <td className="tt-center">{r.no}</td>
              <td className="tt-time">{r.warmUp}</td>
              <td className="tt-time tt-time--compete">{r.compete}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PublicTimetable() {
  const [day, setDay] = useState('saturday');

  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main">

        <section className="tt-hero">
          <div className="tt-hero-inner">
            <p className="tt-hero-label">Competition Timetable</p>
            <h1 className="tt-hero-title">Trampoline League 2025</h1>
            <p className="tt-hero-sub">Good luck to all our competitors!</p>
          </div>
        </section>

        <section className="tt-section">
          <div className="tt-inner">

            <div className="tt-key">
              <span className="tt-tag tt-tag--tri">TRI</span> Trampoline
              <span className="tt-tag tt-tag--dmt">DMT</span> Double Mini Trampoline
              <span className="tt-tag tt-tag--trs">TRS</span> Synchro
            </div>

            <div className="tt-tabs" role="tablist">
              <button
                className={`tt-tab${day === 'saturday' ? ' tt-tab--active' : ''}`}
                onClick={() => setDay('saturday')}
                role="tab"
                aria-selected={day === 'saturday'}
              >
                Saturday
              </button>
              <button
                className={`tt-tab${day === 'sunday' ? ' tt-tab--active' : ''}`}
                onClick={() => setDay('sunday')}
                role="tab"
                aria-selected={day === 'sunday'}
              >
                Sunday
              </button>
            </div>

            {day === 'saturday' && <TimetableTable rows={SATURDAY} />}
            {day === 'sunday'   && <TimetableTable rows={SUNDAY} />}

          </div>
        </section>

      </main>
      <PublicFooter />
    </div>
  );
}
