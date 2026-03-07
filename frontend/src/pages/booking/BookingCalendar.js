import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './BookingCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

export default function BookingCalendar() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [sessions, setSessions] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      bookingApi.getSessions(year, month),
      bookingApi.getClosures(),
    ]).then(([sessRes, closRes]) => {
      setSessions(sessRes.data);
      setClosures(closRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isInClosure = (date) => {
    return closures.some(c => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      start.setHours(0,0,0,0); end.setHours(23,59,59,999);
      return date >= start && date <= end;
    });
  };

  const sessionsForDate = (date) => {
    const dateStr = date.toISOString().slice(0, 10);
    return sessions.filter(s => new Date(s.date).toISOString().slice(0, 10) === dateStr);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));

  return (
    <div className="booking-calendar">
      <div className="booking-calendar__header">
        <button aria-label="Previous month" onClick={prevMonth}>&lsaquo; Previous</button>
        <h2>{MONTHS[month - 1]} {year}</h2>
        <button aria-label="Next month" onClick={nextMonth}>Next &rsaquo;</button>
      </div>

      <div className="booking-calendar__grid">
        {DAYS.map((d, i) => (
          <div key={d} className="booking-calendar__day-label">
            <span className="booking-calendar__day-long">{d}</span>
            <span className="booking-calendar__day-short">{DAYS_SHORT[i]}</span>
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="booking-calendar__cell booking-calendar__cell--empty" />;

          const daySessions = sessionsForDate(date);
          const closed = isInClosure(date);
          const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const hasAvailable = daySessions.some(s => s.availableSlots > 0 && !s.cancelledAt);

          let cellClass = 'booking-calendar__cell';
          if (closed) cellClass += ' booking-calendar__cell--closed';
          else if (isPast) cellClass += ' booking-calendar__cell--past';
          else if (hasAvailable) cellClass += ' booking-calendar__cell--available';
          else if (daySessions.length > 0) cellClass += ' booking-calendar__cell--full';

          return (
            <div key={date.toISOString()} className={cellClass}>
              <span className="booking-calendar__date">{date.getDate()}</span>
              {!closed && daySessions.map(s => (
                <button
                  key={s.id}
                  className={`booking-calendar__session ${s.availableSlots > 0 && !s.cancelledAt && !isPast ? 'booking-calendar__session--open' : 'booking-calendar__session--full'}`}
                  disabled={s.availableSlots === 0 || !!s.cancelledAt || isPast}
                  onClick={() => navigate(`/booking/session/${s.id}`)}
                >
                  {s.startTime} ({s.cancelledAt ? 'Cancelled' : `${s.availableSlots} left`})
                </button>
              ))}
              {closed && <span className="booking-calendar__closed-label">Closed</span>}
            </div>
          );
        })}
      </div>

      {loading && <p className="booking-calendar__loading">Loading...</p>}
    </div>
  );
}
