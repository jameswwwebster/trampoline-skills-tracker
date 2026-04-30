import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Skills() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sort, setSort] = useState({ key: 'level', dir: 'asc' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSkills(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const levelOptions = useMemo(() => {
    const seen = new Map();
    for (const s of skills) {
      if (!seen.has(s.level.id)) seen.set(s.level.id, s.level);
    }
    return Array.from(seen.values()).sort((a, b) => a.number - b.number);
  }, [skills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter(s => {
      if (levelFilter && s.level.id !== levelFilter) return false;
      if (!q) return true;
      const name = (s.name || '').toLowerCase();
      const fig = (s.figNotation || '').toLowerCase();
      return name.includes(q) || fig.includes(q);
    });
  }, [skills, search, levelFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let va, vb;
      switch (key) {
        case 'name':       va = a.name || ''; vb = b.name || ''; break;
        case 'level':      va = a.level.number; vb = b.level.number; break;
        case 'fig':        va = a.figNotation || ''; vb = b.figNotation || ''; break;
        case 'difficulty': va = a.difficulty != null ? Number(a.difficulty) : -1;
                           vb = b.difficulty != null ? Number(b.difficulty) : -1; break;
        case 'routines':   va = a.routineCount; vb = b.routineCount; break;
        default:           va = 0; vb = 0;
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const headerCell = (key, label) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', padding: '0.5rem', borderBottom: '2px solid #ddd', textAlign: 'left' }}
      onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
    >
      {label}{sort.key === key && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
    </th>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/admin-hub')}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ArrowLeftIcon style={{ width: 14, height: 14 }} /> Admin
        </button>
        <h1 style={{ margin: 0 }}>All Skills</h1>
      </div>

      {error && <div style={{ background: '#fee', padding: '0.5rem', borderRadius: 4, marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name or FIG notation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 240px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        >
          <option value="">All levels</option>
          {levelOptions.map(l => (
            <option key={l.id} value={l.id}>L{l.identifier} — {l.name}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
            {sorted.length} skill{sorted.length === 1 ? '' : 's'}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                {headerCell('name', 'Name')}
                {headerCell('level', 'Level')}
                {headerCell('fig', 'FIG')}
                {headerCell('difficulty', 'Difficulty')}
                {headerCell('routines', 'In routines')}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{s.name}</td>
                  <td style={{ padding: '0.5rem' }}>L{s.level.identifier}</td>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{s.figNotation || '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{s.difficulty != null ? Number(s.difficulty).toFixed(1) : '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{s.routineCount}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>No skills match.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
