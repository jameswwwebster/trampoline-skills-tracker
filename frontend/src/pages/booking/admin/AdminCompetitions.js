import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

function getSkillCompetitions() {
  return fetch(`${API_URL}/competitions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }).then(r => r.json());
}

const EMPTY_FORM = {
  name: '',
  location: '',
  startDate: '',
  endDate: '',
  entryDeadline: '',
  lateEntryFee: '',
  description: '',
  categories: [{ name: '', minAge: '', maxAge: '', skillCompetitionIds: [] }],
  priceTiers: [
    { entryNumber: 1, price: '' },
    { entryNumber: 2, price: '' },
    { entryNumber: 3, price: '' },
  ],
};

export default function AdminCompetitions() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [skillCompetitions, setSkillCompetitions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    bookingApi.getCompetitionEvents().then(res => setEvents(res.data));
    getSkillCompetitions().then(data => setSkillCompetitions(Array.isArray(data) ? data : data.competitions || []));
  };

  useEffect(load, []);

  const addCategory = () =>
    setForm(f => ({ ...f, categories: [...f.categories, { name: '', minAge: '', maxAge: '', skillCompetitionIds: [] }] }));

  const removeCategory = (i) =>
    setForm(f => ({ ...f, categories: f.categories.filter((_, idx) => idx !== i) }));

  const updateCategory = (i, key, val) =>
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, idx) => idx === i ? { ...c, [key]: val } : c),
    }));

  const toggleSkillComp = (catIdx, scId) => {
    const cat = form.categories[catIdx];
    const ids = cat.skillCompetitionIds.includes(scId)
      ? cat.skillCompetitionIds.filter(id => id !== scId)
      : [...cat.skillCompetitionIds, scId];
    updateCategory(catIdx, 'skillCompetitionIds', ids);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ageError = form.categories.some(c => {
        const min = c.minAge !== '' ? parseInt(c.minAge, 10) : null;
        const max = c.maxAge !== '' ? parseInt(c.maxAge, 10) : null;
        return min !== null && max !== null && min > max;
      });
      if (ageError) {
        setError('Min age must not exceed max age.');
        setSubmitting(false);
        return;
      }

      const payload = {
        name: form.name,
        location: form.location,
        startDate: form.startDate,
        endDate: form.endDate || null,
        entryDeadline: form.entryDeadline,
        lateEntryFee: form.lateEntryFee ? Math.round(parseFloat(form.lateEntryFee) * 100) : null,
        description: form.description || null,
        categories: form.categories.filter(c => c.name.trim()).map(c => ({
          name: c.name.trim(),
          skillCompetitionIds: c.skillCompetitionIds,
          minAge: c.minAge !== '' ? parseInt(c.minAge, 10) : null,
          maxAge: c.maxAge !== '' ? parseInt(c.maxAge, 10) : null,
        })),
        priceTiers: form.priceTiers
          .filter(t => t.price !== '')
          .map(t => ({ entryNumber: t.entryNumber, price: Math.round(parseFloat(t.price) * 100) })),
      };
      await bookingApi.createCompetitionEvent(payload);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create competition.');
    } finally {
      setSubmitting(false);
    }
  };

  const upcoming = events.filter(e => new Date(e.startDate) >= new Date());
  const past = events.filter(e => new Date(e.startDate) < new Date());

  return (
    <div className="bk-page bk-page--lg">
      <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Competitions</h2>
        <button className="bk-btn bk-btn--primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New competition'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>New competition</h3>
          <div className="bk-grid-2">
            <label className="bk-label">Name
              <input className="bk-input" style={{ marginTop: '0.25rem' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label className="bk-label">Location
              <input className="bk-input" style={{ marginTop: '0.25rem' }} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
            </label>
            <label className="bk-label">Start date
              <input type="date" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </label>
            <label className="bk-label">End date (optional)
              <input type="date" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </label>
            <label className="bk-label">Entry deadline
              <input type="date" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.entryDeadline} onChange={e => setForm(f => ({ ...f, entryDeadline: e.target.value }))} required />
            </label>
            <label className="bk-label">Late entry fee (£) — leave blank for hard deadline
              <input type="number" step="0.01" min="0" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.lateEntryFee} onChange={e => setForm(f => ({ ...f, lateEntryFee: e.target.value }))} placeholder="e.g. 5.00" />
            </label>
          </div>

          <label className="bk-label" style={{ marginTop: '0.75rem' }}>Description (optional)
            <textarea className="bk-input" style={{ marginTop: '0.25rem' }} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </label>

          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.25rem' }}>Entry price tiers</p>
            <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>Tier 3 price applies to 3rd entry and beyond.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {form.priceTiers.map((tier, i) => (
                <label key={tier.entryNumber} className="bk-label" style={{ minWidth: '120px' }}>
                  {i === 0 ? '1st entry (£)' : i === 1 ? '2nd entry (£)' : '3rd+ entries (£)'}
                  <input
                    type="number" step="0.01" min="0"
                    className="bk-input" style={{ marginTop: '0.25rem' }}
                    value={tier.price}
                    onChange={e => setForm(f => ({ ...f, priceTiers: f.priceTiers.map((t, j) => j === i ? { ...t, price: e.target.value } : t) }))}
                    required
                  />
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>Categories</p>
              <button type="button" className="bk-btn bk-btn--sm" onClick={addCategory}>+ Add category</button>
            </div>
            {form.categories.map((cat, i) => (
              <div key={i} className="bk-card" style={{ marginBottom: '0.5rem', padding: '0.75rem' }}>
                <div className="bk-row" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    className="bk-input"
                    placeholder="Category name e.g. Women's 13-14"
                    value={cat.name}
                    onChange={e => updateCategory(i, 'name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min="0"
                    className="bk-input"
                    placeholder="Min age"
                    value={cat.minAge}
                    onChange={e => updateCategory(i, 'minAge', e.target.value)}
                    style={{ width: 80 }}
                  />
                  <input
                    type="number"
                    min="0"
                    className="bk-input"
                    placeholder="Max age"
                    value={cat.maxAge}
                    onChange={e => updateCategory(i, 'maxAge', e.target.value)}
                    style={{ width: 80 }}
                  />
                  {form.categories.length > 1 && (
                    <button type="button" className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)' }} onClick={() => removeCategory(i)}>Remove</button>
                  )}
                </div>
                {skillCompetitions.length > 0 && (
                  <div>
                    <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.35rem' }}>Eligible if gymnast has achieved (optional):</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {skillCompetitions.filter(sc => sc.isActive).map(sc => (
                        <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={cat.skillCompetitionIds.includes(sc.id)}
                            onChange={() => toggleSkillComp(i, sc.id)}
                          />
                          {sc.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="bk-error">{error}</p>}
          <button type="submit" className="bk-btn bk-btn--primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create competition'}
          </button>
        </form>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="bk-muted">No competitions yet.</p>
      )}

      {upcoming.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {upcoming.map(ev => <CompetitionCard key={ev.id} event={ev} onClick={() => navigate(`/booking/admin/competitions/${ev.id}`)} />)}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Past</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {past.map(ev => <CompetitionCard key={ev.id} event={ev} onClick={() => navigate(`/booking/admin/competitions/${ev.id}`)} />)}
          </div>
        </>
      )}
    </div>
  );
}

function CompetitionCard({ event, onClick }) {
  const isLate = new Date() > new Date(event.entryDeadline);
  const hasLateFee = event.lateEntryFee !== null;
  return (
    <div className="bk-card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>{event.name}</p>
          <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
            {event.location} · {new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="bk-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
            Deadline: {new Date(event.entryDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {isLate && hasLateFee && <span style={{ color: 'var(--booking-warning)', marginLeft: '0.5rem' }}>Late entries: +£{(event.lateEntryFee / 100).toFixed(2)}</span>}
            {isLate && !hasLateFee && <span style={{ color: 'var(--booking-danger)', marginLeft: '0.5rem' }}>Closed</span>}
          </p>
        </div>
        <span className="bk-muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{event._count?.entries ?? 0} entries</span>
      </div>
    </div>
  );
}
