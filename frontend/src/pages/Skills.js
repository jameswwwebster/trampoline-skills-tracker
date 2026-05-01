import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeftIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { matchesSkillQuery } from '../utils/skillSearch';
import SkillFormModal from '../components/SkillFormModal';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Click-to-edit cell. Renders display value until clicked; then becomes an input.
// Enter or blur saves; Escape cancels. type='number' for numeric fields.
function EditableCell({ value, type = 'text', step, onSave, disabled, monospace, formatDisplay }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [errored, setErrored] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (!editing) setDraft(value ?? ''); }, [value, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

  const commit = async () => {
    if (saving) return;
    const normalized = type === 'number'
      ? (draft === '' || draft == null ? null : Number(draft))
      : (draft === '' ? null : String(draft));
    const current = value ?? null;
    if (normalized === current) { setEditing(false); return; }
    setSaving(true);
    setErrored(false);
    try {
      await onSave(normalized);
      setEditing(false);
    } catch (e) {
      setErrored(true);
    } finally {
      setSaving(false);
    }
  };

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
        }}
        disabled={saving}
        style={{
          width: '100%',
          padding: '0.25rem 0.4rem',
          border: `1px solid ${errored ? '#e74c3c' : '#7c35e8'}`,
          borderRadius: 3,
          fontSize: '0.9rem',
          fontFamily: monospace ? 'monospace' : 'inherit',
        }}
      />
    );
  }

  const display = formatDisplay ? formatDisplay(value) : (value == null || value === '' ? '—' : String(value));
  return (
    <span
      onClick={() => !disabled && setEditing(true)}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: monospace ? 'monospace' : 'inherit',
        opacity: saving ? 0.5 : 1,
        color: errored ? '#e74c3c' : 'inherit',
        borderBottom: disabled ? 'none' : '1px dashed #ccc',
      }}
      title={disabled ? '' : 'Click to edit'}
    >
      {display}
    </span>
  );
}

export default function Skills() {
  const navigate = useNavigate();
  const { isClubAdmin } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sort, setSort] = useState({ key: 'level', dir: 'asc' });
  const [editing, setEditing] = useState(null); // skill object or null
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null); // skill object pending confirm, or null

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

  const patchSkill = useCallback(async (skillId, patch) => {
    const token = localStorage.getItem('token');
    const res = await axios.put(`${API_BASE}/api/skills/${skillId}`, patch, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, ...res.data } : s));
  }, []);

  const handleSaveEdit = async (data) => {
    if (!editing) return;
    try {
      await patchSkill(editing.id, data);
      setEditing(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save skill');
    }
  };

  const handleDelete = async (skill) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/skills/${skill.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSkills(prev => prev.filter(s => s.id !== skill.id));
      setDeleting(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete skill');
      setDeleting(null);
    }
  };

  const handleCreate = async (data) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/api/skills`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Reload to get the full shape with levels[]/_count etc.
      await load();
      setCreating(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create skill');
    }
  };

  const levelOptions = useMemo(() => {
    const seen = new Map();
    for (const s of skills) {
      for (const l of (s.levels || [])) {
        if (l.id && !seen.has(l.id)) seen.set(l.id, l);
      }
    }
    return Array.from(seen.values()).sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [skills]);

  const filtered = useMemo(() => {
    return skills.filter(s => {
      if (levelFilter === '__library__') {
        if ((s.levels || []).length > 0) return false;
      } else if (levelFilter) {
        if (!(s.levels || []).some(l => l.id === levelFilter)) return false;
      }
      return matchesSkillQuery(search, s.name, s.figNotation);
    });
  }, [skills, search, levelFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let va, vb;
      const firstLevelNum = s => ((s.levels && s.levels[0] && s.levels[0].number) || 999);
      switch (key) {
        case 'name':       va = a.name || ''; vb = b.name || ''; break;
        case 'level':      va = firstLevelNum(a); vb = firstLevelNum(b); break;
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
        {isClubAdmin && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn btn-primary"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <PlusIcon style={{ width: 14, height: 14 }} /> New skill
          </button>
        )}
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
          <option value="__library__">Library only (unattached)</option>
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
                {isClubAdmin && <th style={{ padding: '0.5rem', borderBottom: '2px solid #ddd', width: 80 }} />}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const levelLabel = (s.levels && s.levels.length > 0)
                  ? s.levels.map(l => `L${l.identifier}`).join(', ')
                  : <span style={{ color: '#888', fontStyle: 'italic' }}>Library</span>;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <EditableCell
                        value={s.name}
                        disabled={!isClubAdmin}
                        onSave={(v) => patchSkill(s.id, { name: v })}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>{levelLabel}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <EditableCell
                        value={s.figNotation}
                        disabled={!isClubAdmin}
                        monospace
                        onSave={(v) => patchSkill(s.id, { figNotation: v })}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <EditableCell
                        value={s.difficulty != null ? Number(s.difficulty) : null}
                        type="number"
                        step="0.1"
                        disabled={!isClubAdmin}
                        formatDisplay={(v) => v == null ? '—' : Number(v).toFixed(1)}
                        onSave={(v) => patchSkill(s.id, { difficulty: v })}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>{s.routineCount}</td>
                    {isClubAdmin && (
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="btn btn-secondary btn-sm"
                          title="Open full editor"
                          style={{ padding: '0.25rem 0.4rem', display: 'inline-flex', alignItems: 'center', marginRight: 4 }}
                        >
                          <PencilSquareIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(s)}
                          className="btn btn-secondary btn-sm"
                          title="Delete skill"
                          style={{ padding: '0.25rem 0.4rem', display: 'inline-flex', alignItems: 'center', color: '#c0392b', borderColor: 'rgba(192,57,43,0.4)' }}
                        >
                          <TrashIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={isClubAdmin ? 6 : 5} style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>No skills match.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {creating && (
        <SkillFormModal
          mode="add"
          showOrder={false}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <SkillFormModal
          mode="edit"
          skill={editing}
          showOrder={false}
          onSave={handleSaveEdit}
          onCancel={() => setEditing(null)}
        />
      )}
      {deleting && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Delete skill</h3>
              <button onClick={() => setDeleting(null)} className="close-button">×</button>
            </div>
            <div style={{ padding: '0.75rem 0' }}>
              <p style={{ margin: 0 }}>Permanently delete <strong>{deleting.name}</strong>?</p>
              {deleting.routineCount > 0 && (
                <p style={{ marginTop: '0.5rem', color: '#c0392b', fontSize: '0.9rem' }}>
                  This skill is used in {deleting.routineCount} routine{deleting.routineCount === 1 ? '' : 's'}. The server will block the delete until you remove it from those routines first.
                </p>
              )}
              {(deleting.levels || []).length > 0 && (
                <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                  Currently attached to: {deleting.levels.map(l => `L${l.identifier}`).join(', ')}.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#c0392b', borderColor: '#c0392b' }}
                onClick={() => handleDelete(deleting)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
