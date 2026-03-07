import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

export default function MyChildren() {
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () =>
    bookingApi.getBookableGymnasts()
      .then(r => setGymnasts(r.data))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleSelf = async () => {
    setError(null);
    try {
      await bookingApi.createSelfGymnast();
      load();
    } catch (err) {
      setError('Could not create your gymnast profile.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await bookingApi.addChild(form);
      setForm({ firstName: '', lastName: '', dateOfBirth: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add child.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasSelf = gymnasts.some(g => g.isSelf);
  const children = gymnasts.filter(g => !g.isSelf);

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <h2>My Account</h2>

      {/* Self */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>Myself</h3>
        {hasSelf ? (
          gymnasts.filter(g => g.isSelf).map(g => (
            <div key={g.id} className="bk-card">
              <strong>{g.firstName} {g.lastName}</strong>
              {g.dateOfBirth && (
                <span className="bk-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                  DOB: {new Date(g.dateOfBirth).toLocaleDateString('en-GB')}
                </span>
              )}
            </div>
          ))
        ) : (
          <div>
            <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
              Add yourself to book sessions under your own name.
            </p>
            <button className="bk-btn bk-btn--primary" onClick={handleSelf}>
              Add myself as a gymnast
            </button>
          </div>
        )}
      </section>

      {/* Children */}
      <section>
        <div className="bk-row bk-row--between" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Children</h3>
          <button className="bk-btn bk-btn--primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ Add child'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '1rem' }}>
            <div className="bk-grid-2">
              <label className="bk-label">First name
                <input
                  className="bk-input"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  required
                  style={{ marginTop: '0.25rem' }}
                />
              </label>
              <label className="bk-label">Last name
                <input
                  className="bk-input"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  required
                  style={{ marginTop: '0.25rem' }}
                />
              </label>
            </div>
            <label className="bk-label">Date of birth <span className="bk-muted">(optional — needed for age-restricted sessions)</span>
              <input
                type="date"
                className="bk-input"
                value={form.dateOfBirth}
                onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                style={{ marginTop: '0.25rem' }}
              />
            </label>
            {error && <p className="bk-error">{error}</p>}
            <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
              {submitting ? 'Saving...' : 'Save child'}
            </button>
          </form>
        )}

        {children.length === 0 && !showForm && (
          <p className="bk-muted">No children added yet.</p>
        )}
        {children.map(g => (
          <div key={g.id} className="bk-card">
            <strong>{g.firstName} {g.lastName}</strong>
            {g.dateOfBirth ? (
              <span className="bk-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                DOB: {new Date(g.dateOfBirth).toLocaleDateString('en-GB')}
              </span>
            ) : (
              <span className="bk-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                No date of birth
              </span>
            )}
          </div>
        ))}
      </section>

      {error && !showForm && <p className="bk-error">{error}</p>}
    </div>
  );
}
