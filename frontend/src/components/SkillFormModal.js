import React, { useState, useEffect, useMemo } from 'react';
import { computeFigDifficulty } from '../utils/figDifficulty';

// Encode/decode the halfTwistsPerSom array to the FIG digit string convention.
//   [0, 1]  ⇄ '-1'
//   [0, 0]  ⇄ '--'
//   [4]     ⇄ '4'
//   []      ⇄ ''
export function encodeHalfTwists(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(t => (t === 0 || t == null) ? '-' : String(t)).join('');
}
export function decodeHalfTwists(str) {
  if (!str) return [];
  return str.split('').map(c => (c === '-' ? 0 : Number(c) || 0));
}

// Unified Add/Edit Skill modal. Structured fields drive the FIG calculator;
// difficulty / FIG / suggested name auto-populate but stay editable for overrides.
// Set showOrder=false when called outside a level context (library skills).
export default function SkillFormModal({ mode, skill = null, onSave, onCancel, showOrder = true }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [order, setOrder] = useState(skill?.order ?? 1);

  // Structured params
  const [quarterSoms, setQuarterSoms] = useState(skill?.quarterSoms ?? 0);
  const [twistsArr, setTwistsArr] = useState(decodeHalfTwists(skill?.halfTwistsPerSom ?? ''));
  const [shape, setShape] = useState(skill?.shape ?? '');
  const [landing, setLanding] = useState(skill?.landing ?? 'feet');
  const [direction, setDirection] = useState(skill?.direction ?? 'backward');

  // Derived (editable)
  const [difficulty, setDifficulty] = useState(skill?.difficulty != null ? String(skill.difficulty) : '');
  const [figNotation, setFigNotation] = useState(skill?.figNotation ?? '');
  const [diffOverridden, setDiffOverridden] = useState(isEdit && skill?.difficulty != null);
  const [figOverridden, setFigOverridden] = useState(isEdit && !!skill?.figNotation);

  // Keep twistsArr length in sync with quarterSoms.
  const expectedTwistEntries = Math.max(quarterSoms > 0 || twistsArr.some(t => t > 0) ? 1 : 0, Math.ceil(quarterSoms / 4));
  useEffect(() => {
    setTwistsArr(prev => {
      const next = prev.slice(0, expectedTwistEntries);
      while (next.length < expectedTwistEntries) next.push(0);
      return next;
    });
  }, [expectedTwistEntries]);

  const calc = useMemo(() => computeFigDifficulty({
    quarterSoms,
    halfTwistsPerSom: twistsArr,
    shape: shape || null,
    landing,
    direction,
  }), [quarterSoms, twistsArr, shape, landing, direction]);

  useEffect(() => { if (!diffOverridden) setDifficulty(String(calc.difficulty)); }, [calc.difficulty, diffOverridden]);
  useEffect(() => { if (!figOverridden) setFigNotation(calc.figNotation); }, [calc.figNotation, figOverridden]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name,
      description,
      quarterSoms: Number(quarterSoms) || 0,
      halfTwistsPerSom: encodeHalfTwists(twistsArr),
      shape: shape || null,
      landing: landing || null,
      direction: direction || null,
      difficulty: difficulty === '' ? null : Number(difficulty),
      figNotation: figNotation || null,
    };
    if (showOrder) payload.order = parseInt(order) || 1;
    onSave(payload);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Skill' : 'Add New Skill'}</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Skill Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="2"
            />
          </div>

          <fieldset style={{ border: '1px solid #ddd', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <legend style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>Structured parameters (FIG §17.1)</legend>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label>¼ somersaults</label>
                <input
                  type="number"
                  value={quarterSoms === 0 ? '' : quarterSoms}
                  min="0" max="16"
                  onChange={(e) => { setQuarterSoms(parseInt(e.target.value) || 0); setDiffOverridden(false); setFigOverridden(false); }}
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label>Direction</label>
                <select value={direction} onChange={e => { setDirection(e.target.value); setDiffOverridden(false); setFigOverridden(false); }}>
                  <option value="backward">Backward</option>
                  <option value="forward">Forward</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label>Shape</label>
                <select value={shape} onChange={e => { setShape(e.target.value); setDiffOverridden(false); setFigOverridden(false); }}>
                  <option value="">— none —</option>
                  <option value="tuck">Tuck</option>
                  <option value="pike">Pike</option>
                  <option value="straight">Straight</option>
                  <option value="straddle">Straddle</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label>Landing</label>
                <select value={landing} onChange={e => { setLanding(e.target.value); setDiffOverridden(false); setFigOverridden(false); }}>
                  <option value="feet">Feet</option>
                  <option value="seat">Seat</option>
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                  <option value="hands">Hands</option>
                </select>
              </div>
            </div>

            {expectedTwistEntries > 0 && (
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>½ twists per somersault</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {twistsArr.map((t, i) => (
                    <input
                      key={i}
                      type="number"
                      min="0"
                      max="9"
                      value={t === 0 ? '' : t}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(9, parseInt(e.target.value) || 0));
                        setTwistsArr(arr => arr.map((x, j) => j === i ? v : x));
                        setDiffOverridden(false);
                        setFigOverridden(false);
                      }}
                      style={{ width: 56, textAlign: 'center' }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: '#f6f6f8', padding: '0.5rem 0.75rem', borderRadius: 4, marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {calc.breakdown.map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{b.label}</span>
                  <span>{b.points >= 0 ? '+' : ''}{b.points.toFixed(1)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: 4, marginTop: 4, fontWeight: 700 }}>
                <span>Computed difficulty</span>
                <span>{calc.difficulty.toFixed(1)}</span>
              </div>
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label>Difficulty {diffOverridden && <small style={{ color: '#c0392b' }}>(override)</small>}</label>
              <input
                type="number"
                step="0.1"
                value={difficulty}
                onChange={e => { setDifficulty(e.target.value); setDiffOverridden(true); }}
              />
              {diffOverridden && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDifficulty(String(calc.difficulty)); setDiffOverridden(false); }} style={{ marginTop: 4, fontSize: '0.75rem' }}>Reset to calculated</button>
              )}
            </div>
            <div className="form-group" style={{ flex: '1 1 160px' }}>
              <label>FIG notation {figOverridden && <small style={{ color: '#c0392b' }}>(override)</small>}</label>
              <input
                type="text"
                value={figNotation}
                onChange={e => { setFigNotation(e.target.value); setFigOverridden(true); }}
              />
              {figOverridden && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFigNotation(calc.figNotation); setFigOverridden(false); }} style={{ marginTop: 4, fontSize: '0.75rem' }}>Reset to calculated</button>
              )}
            </div>
            {showOrder && (
              <div className="form-group" style={{ flex: '0 1 100px' }}>
                <label>Order</label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  min="1"
                />
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Add Skill'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
