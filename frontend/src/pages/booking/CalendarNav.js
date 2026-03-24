import React, { useState, useEffect } from 'react';
import './BookingCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function defaultGetMonthCellClass(date, daySessions, isPast, isClosed) {
  if (isClosed) return 'booking-calendar__cell--closed';
  if (isPast) return 'booking-calendar__cell--past';
  if (daySessions.some(s => s.availableSlots > 0 && !s.cancelledAt)) return 'booking-calendar__cell--available';
  if (daySessions.length > 0) return 'booking-calendar__cell--full';
  return '';
}

/**
 * Shared calendar navigation shell.
 *
 * Props:
 *   sessions            SessionInstance[]     All loaded sessions for the current period
 *   onNavigate          (date: Date) => void  Called on every selectedDate change; parent re-fetches
 *   loading?            boolean               Show loading indicator (default false)
 *   closures?           Closure[]             For closure highlighting (default [])
 *   renderDayDots       (date, daySessions, isPast, isClosed) => ReactNode
 *   renderDayPanel      (date, daySessions, isPast, isClosed) => ReactNode
 *   renderMonthCell     (date, daySessions, isToday, isPast, isClosed) => ReactNode
 *   getMonthCellClass?  (date, daySessions, isPast, isClosed) => string  (optional)
 */
export default function CalendarNav({
  sessions,
  onNavigate,
  loading = false,
  closures = [],
  renderDayDots,
  renderDayPanel,
  renderMonthCell,
  getMonthCellClass = defaultGetMonthCellClass,
}) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState('week');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  useEffect(() => {
    onNavigate(selectedDate);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekStart = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const prevWeek = () => setSelectedDate(d => { const p = new Date(d); p.setDate(p.getDate() - 7); return p; });
  const nextWeek = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const prevMonth = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const jumpToMonth = (y, m) => {
    setSelectedDate(new Date(y, m - 1, 1));
    setShowMonthPicker(false);
  };

  const buildWeekDays = () => {
    const ws = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const isInClosure = (date) =>
    closures.some(c => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });

  const sessionsForDate = (date) => {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    return sessions.filter(s => {
      const sd = new Date(s.date);
      return sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d;
    });
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  // ── Month grid view ──
  if (viewMode === 'month') {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));

    return (
      <div className="booking-calendar">
        <div className="booking-calendar__header">
          <button onClick={prevMonth}>&lsaquo; Prev</button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{MONTHS[month - 1]} {year}</h2>
          <button onClick={nextMonth}>Next &rsaquo;</button>
        </div>
        <button className="booking-calendar__back-to-week" onClick={() => setViewMode('week')}>
          ← Week view
        </button>
        <div className="booking-calendar__grid">
          {DAYS.map(d => (
            <div key={d} className="booking-calendar__day-label">{d}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} className="booking-calendar__cell booking-calendar__cell--empty" />;
            const ds = sessionsForDate(date);
            const isToday = date.toDateString() === today.toDateString();
            const isPast = date < todayMidnight;
            const isClosed = isInClosure(date);
            const extraClass = getMonthCellClass(date, ds, isPast, isClosed);
            return (
              <div
                key={date.toISOString()}
                className={['booking-calendar__cell', extraClass].filter(Boolean).join(' ')}
                onClick={() => { setSelectedDate(new Date(date)); setViewMode('week'); }}
              >
                <span className="booking-calendar__date">{date.getDate()}</span>
                {renderMonthCell(date, ds, isToday, isPast, isClosed)}
              </div>
            );
          })}
        </div>
        {loading && <p className="booking-calendar__loading">Loading…</p>}
      </div>
    );
  }

  // ── Week view ──
  const weekDays = buildWeekDays();
  const selectedMidnight = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const dayIsPast = selectedMidnight < todayMidnight;
  const daySessions = sessionsForDate(selectedDate);
  const dayIsClosed = isInClosure(selectedDate);

  return (
    <div className="booking-calendar">
      <div className="booking-calendar__header">
        <button aria-label="Previous week" onClick={prevWeek}>&#8249;</button>
        <button
          className="booking-calendar__month-btn"
          onClick={() => { setShowMonthPicker(p => !p); setPickerYear(selectedDate.getFullYear()); }}
        >
          {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()} ▾
        </button>
        <button aria-label="Next week" onClick={nextWeek}>&#8250;</button>
      </div>

      {showMonthPicker && (
        <div className="booking-calendar__month-picker">
          <div className="booking-calendar__month-picker-header">
            <button onClick={() => setPickerYear(y => y - 1)}>&#8249;</button>
            <span>{pickerYear}</span>
            <button onClick={() => setPickerYear(y => y + 1)}>&#8250;</button>
          </div>
          <div className="booking-calendar__month-picker-grid">
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
          <button
            className="booking-calendar__view-month-btn"
            onClick={() => { setShowMonthPicker(false); setViewMode('month'); }}
          >
            View full month →
          </button>
        </div>
      )}

      <div className="booking-calendar__week-strip">
        {weekDays.map(d => {
          const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const isSelected = d.toDateString() === selectedDate.toDateString();
          const isToday = d.toDateString() === today.toDateString();
          const isPast = dMidnight < todayMidnight;
          const isClosed = isInClosure(d);
          const ds = sessionsForDate(d);

          let cls = 'booking-calendar__week-day';
          if (isSelected) cls += ' booking-calendar__week-day--selected';
          if (isToday && !isSelected) cls += ' booking-calendar__week-day--today';
          if (isPast) cls += ' booking-calendar__week-day--past';
          if (isClosed) cls += ' booking-calendar__week-day--closed';

          return (
            <div key={d.toISOString()} className={cls} onClick={() => setSelectedDate(new Date(d))}>
              <span className="booking-calendar__week-day-name">{DAY_NAMES_SHORT[d.getDay()]}</span>
              <span className="booking-calendar__week-day-num">{d.getDate()}</span>
              <div className="booking-calendar__week-day-dots">
                {renderDayDots(d, ds, isPast, isClosed)}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="booking-calendar__day-detail"
        style={{ '--detail-arrow': `${(selectedDate.getDay() + 0.5) / 7 * 100}%` }}
      >
        {renderDayPanel(selectedDate, daySessions, dayIsPast, dayIsClosed)}
      </div>

      {loading && <p className="booking-calendar__loading">Loading…</p>}
    </div>
  );
}
