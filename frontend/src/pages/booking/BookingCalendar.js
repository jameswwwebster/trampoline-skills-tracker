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

  // Mobile view state
  const [selectedDate, setSelectedDate] = useState(today);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

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

  // Keep year/month in sync with selectedDate (triggers data re-fetch when crossing month boundary)
  useEffect(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    if (y !== year || m !== month) {
      setYear(y);
      setMonth(m);
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Returns the Sunday that starts the week containing `date`
  const weekStart = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // back to Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const prevWeek = () => {
    setSelectedDate(d => {
      const ws = weekStart(d);
      ws.setDate(ws.getDate() - 7);
      return ws;
    });
  };

  const nextWeek = () => {
    setSelectedDate(d => {
      const ws = weekStart(d);
      ws.setDate(ws.getDate() + 7);
      return ws;
    });
  };

  const jumpToMonth = (y, m) => {
    setSelectedDate(new Date(y, m - 1, 1));
    setShowMonthPicker(false);
  };

  // Build the 7 days of the week containing selectedDate
  const buildWeekDays = () => {
    const ws = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
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
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    return sessions.filter(s => {
      const sd = new Date(s.date);
      return sd.getUTCFullYear() === y && sd.getUTCMonth() === m && sd.getUTCDate() === d;
    });
  };

  const sessionLabel = (s) => {
    if (s.cancelledAt) return 'Cancelled';
    if (s.isBooked) return 'Booked';
    if (s.availableSlots === 0) return 'Full';
    return `${s.availableSlots} left`;
  };

  const sessionClass = (s, isPast) => {
    if (s.isBooked) return 'booking-calendar__session--booked';
    if (s.availableSlots > 0 && !s.cancelledAt && !isPast) return 'booking-calendar__session--open';
    return 'booking-calendar__session--full';
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekDays = buildWeekDays();
  const selectedMidnight = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const daySessions = sessionsForDate(selectedDate);
  const dayIsClosed = isInClosure(selectedDate);
  const dayIsPast = selectedMidnight < todayMidnight;

  const DAY_NAMES_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="booking-calendar">

      {/* ── Desktop view (≥521px) ── */}
      <div className="booking-calendar__desktop">
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
            const isPast = date < todayMidnight;
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
                    className={`booking-calendar__session ${sessionClass(s, isPast)}`}
                    disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || isPast}
                    onClick={() => navigate(`/booking/session/${s.id}`)}
                  >
                    {s.startTime} ({sessionLabel(s)})
                  </button>
                ))}
                {closed && <span className="booking-calendar__closed-label">Closed</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mobile view (≤520px) ── */}
      <div className="booking-calendar__mobile">

        {/* Header: week nav + month/year */}
        <div className="booking-calendar__mobile-header">
          <button aria-label="Previous week" onClick={prevWeek}>&#8249;</button>
          <button
            className="booking-calendar__month-btn"
            onClick={() => { setShowMonthPicker(p => !p); setPickerYear(selectedDate.getFullYear()); }}
          >
            {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()} ▾
          </button>
          <button aria-label="Next week" onClick={nextWeek}>&#8250;</button>
        </div>

        {/* Month picker overlay */}
        {showMonthPicker && (
          <div className="booking-calendar__month-picker">
            <div className="booking-calendar__month-picker-header">
              <button onClick={() => setPickerYear(y => y - 1)}>&#8249;</button>
              <span>{pickerYear}</span>
              <button onClick={() => setPickerYear(y => y + 1)}>&#8250;</button>
            </div>
            <div className="booking-calendar__month-grid">
              {MONTH_NAMES_SHORT.map((name, idx) => (
                <button
                  key={name}
                  className={`booking-calendar__month-option${
                    pickerYear === selectedDate.getFullYear() && idx === selectedDate.getMonth()
                      ? ' booking-calendar__month-option--active' : ''
                  }`}
                  onClick={() => jumpToMonth(pickerYear, idx + 1)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Week strip */}
        <div className="booking-calendar__week-strip">
          {weekDays.map(d => {
            const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const isSelected = d.toDateString() === selectedDate.toDateString();
            const isToday = d.toDateString() === today.toDateString();
            const isPast = dMidnight < todayMidnight;
            const ds = sessionsForDate(d);
            const closed = isInClosure(d);

            let cls = 'booking-calendar__week-day';
            if (isSelected) cls += ' booking-calendar__week-day--selected';
            if (isToday && !isSelected) cls += ' booking-calendar__week-day--today';
            if (isPast) cls += ' booking-calendar__week-day--past';

            // Up to 3 dots per day
            const dots = closed ? [] : ds.slice(0, 3).map(s => {
              if (s.isBooked) return 'booked';
              if (s.availableSlots > 0 && !s.cancelledAt) return 'open';
              return 'full';
            });

            return (
              <div key={d.toISOString()} className={cls} onClick={() => setSelectedDate(new Date(d))}>
                <span className="booking-calendar__week-day-name">{DAY_NAMES_SHORT[d.getDay()]}</span>
                <span className="booking-calendar__week-day-num">{d.getDate()}</span>
                <div className="booking-calendar__week-day-dots">
                  {dots.map((type, i) => (
                    <span
                      key={i}
                      className={`booking-calendar__week-dot${
                        type === 'booked' ? ' booking-calendar__week-dot--booked'
                        : type === 'full' ? ' booking-calendar__week-dot--full'
                        : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day detail */}
        <div className="booking-calendar__day-detail">
          <p className="booking-calendar__day-detail-heading">
            {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {dayIsClosed && (
            <p className="booking-calendar__day-closed">Closed</p>
          )}
          {!dayIsClosed && daySessions.length === 0 && (
            <p className="booking-calendar__day-empty">No sessions</p>
          )}
          {!dayIsClosed && daySessions.map(s => (
            <button
              key={s.id}
              className={`booking-calendar__day-session booking-calendar__day-session--${sessionClass(s, dayIsPast).split('--')[1]}`}
              disabled={(!s.isBooked && s.availableSlots === 0) || !!s.cancelledAt || dayIsPast}
              onClick={() => navigate(`/booking/session/${s.id}`)}
            >
              <span className="booking-calendar__day-session-time">{s.startTime}–{s.endTime}</span>
              <span className="booking-calendar__day-session-status">{sessionLabel(s)}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="booking-calendar__loading">Loading…</p>}
    </div>
  );
}
