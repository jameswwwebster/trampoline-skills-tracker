// Difficulty + FIG notation calculator for trampoline skills.
// Rules: FIG Trampoline Code of Points 2025–2028, §17.1.
//   17.1.1.1  Each ¼ somersault (90°)         = 0.1
//   17.1.1.2  Each complete single som (360°) = 0.5  (= 4×0.1 + 0.1 bonus)
//   17.1.1.3  Each complete double som (720°) = 1.0  (= 8×0.1 + 0.2 bonus)
//   17.1.1.4  Each complete triple som (1080°)= 1.6  (= 12×0.1 + 0.4 bonus)
//   17.1.1.5  Each complete quadruple (1440°) = 2.2  (= 16×0.1 + 0.6 bonus)
//   17.1.1.6  Each ½ twist (180°)              = 0.1
//   17.1.4    Single som 360°–630°, no twist, pike/straight: +0.1
//   17.1.5    Multiple som 720°+, pike/straight: +0.1 per som
//   17.1.6.1  Backward double 720–990° = +0.1; triple 1080–1350° = +0.2; quad = +0.3
//   17.1.6.2  Twisting double >720° twist: +0.1 per extra 180°
//   17.1.6.3  Twisting triple >360° twist: +0.2 per extra 180°
//   17.1.6.4  Twisting quadruple: +0.2 per 180° twist
//
// Notation grammar (matches seed-skill-difficulty.js conventions):
//   [quarterDigit][halfTwistsPerSom...][landingSuffix?]
//   - quarterDigit: '0'–'9' or '-' if quarterSoms is 0 but twist follows
//   - halfTwistsPerSom: one char per som — '-' for 0, '1'–'9' for half-twist count
//   - landingSuffix:
//       feet + shape         → 'o' tuck, '<' pike, 'v' straddle, '/' straight
//       feet + twist only    → (none — feet is implicit)
//       seat                 → '--'
//       front                → 'f'
//       back                 → '-' (only when there are twists; otherwise implicit at end)
//   - Pure jumps / landings (no rotation, no twist) collapse to just the landing token:
//       Tuck Jump = 'o', Pike Jump = '<', Seat Landing = '--', Back Landing = '1-', Front Landing = '1-f'.

const SOM_BONUS = { 0: 0, 1: 0.1, 2: 0.2, 3: 0.4, 4: 0.6 };

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Returns { difficulty, breakdown } where breakdown is [{ label, points }]
function computeDifficulty({ quarterSoms = 0, halfTwistsPerSom = [], shape = null, direction = 'backward' } = {}) {
  const breakdown = [];
  let total = 0;

  // §17.1.2: pure jumps / seat drop (no rotation, no twist) = 0.1
  const totalHalfTwists = halfTwistsPerSom.reduce((s, t) => s + (t || 0), 0);
  if (quarterSoms === 0 && totalHalfTwists === 0) {
    breakdown.push({ label: 'Base jump (§17.1.2)', points: 0.1 });
    return { difficulty: 0.1, breakdown };
  }

  // Quarter somersaults (§17.1.1.1)
  if (quarterSoms > 0) {
    const points = round1(quarterSoms * 0.1);
    breakdown.push({ label: `${quarterSoms} × ¼ som (§17.1.1.1)`, points });
    total += points;
  }

  // Half twists (§17.1.1.6)
  if (totalHalfTwists > 0) {
    const points = round1(totalHalfTwists * 0.1);
    breakdown.push({ label: `${totalHalfTwists} × ½ twist (§17.1.1.6)`, points });
    total += points;
  }

  // Somersault completion bonus (§17.1.1.2–5 — full soms add a step bonus)
  const completeSoms = Math.floor(quarterSoms / 4);
  const somBonus = SOM_BONUS[completeSoms] ?? 0.6 + (completeSoms - 4) * 0.2;
  if (somBonus > 0) {
    breakdown.push({ label: `${completeSoms}-som completion bonus (§17.1.1)`, points: round1(somBonus) });
    total += somBonus;
  }

  // Shape bonus.
  // §17.1.4 (single som 360°–630° pike/straight, no twist): +0.1.
  //   Following the FIG difficulty tables, this also applies to single soms with
  //   ≤ 1 half-twist (Barani Pike = 0.7, not 0.6). 2+ half-twists drop the bonus
  //   (Full = 0.7, Rudi = 0.8, Double Full = 0.9 — all without shape bonus).
  // §17.1.5 (multi som 720°+ pike/straight): +0.1 per som, with or without twist.
  if ((shape === 'pike' || shape === 'straight')) {
    if (completeSoms === 1 && totalHalfTwists <= 1) {
      breakdown.push({ label: `${shape} (§17.1.4)`, points: 0.1 });
      total += 0.1;
    } else if (completeSoms >= 2) {
      const points = round1(completeSoms * 0.1);
      breakdown.push({ label: `${shape} × ${completeSoms} som (§17.1.5)`, points });
      total += points;
    }
  }

  // Backward bonus (§17.1.6.1) — backward multi-soms in the listed ranges, no twist
  if (direction === 'backward' && completeSoms >= 2 && totalHalfTwists === 0) {
    let backBonus = 0;
    if (completeSoms === 2 && quarterSoms <= 11) backBonus = 0.1;
    else if (completeSoms === 3 && quarterSoms <= 15) backBonus = 0.2;
    else if (completeSoms === 4 && quarterSoms <= 16) backBonus = 0.3;
    if (backBonus > 0) {
      breakdown.push({ label: `Backward ${completeSoms}-som (§17.1.6.1)`, points: backBonus });
      total += backBonus;
    }
  }

  // Twist bonuses for multi-som elements (§17.1.6.2–4)
  if (completeSoms === 2 && totalHalfTwists > 4) {
    const extra = totalHalfTwists - 4; // half-twists beyond 720°
    const points = round1(extra * 0.1);
    breakdown.push({ label: `Twisting double >720° twist (§17.1.6.2)`, points });
    total += points;
  } else if (completeSoms === 3 && totalHalfTwists > 2) {
    const extra = totalHalfTwists - 2;
    const points = round1(extra * 0.2);
    breakdown.push({ label: `Twisting triple >360° twist (§17.1.6.3)`, points });
    total += points;
  } else if (completeSoms === 4 && totalHalfTwists > 0) {
    const points = round1(totalHalfTwists * 0.2);
    breakdown.push({ label: `Twisting quadruple (§17.1.6.4)`, points });
    total += points;
  }

  return { difficulty: round1(total), breakdown };
}

const SHAPE_TO_SYMBOL = { tuck: 'o', pike: '<', straddle: 'v', straight: '/' };

function computeFigNotation({ quarterSoms = 0, halfTwistsPerSom = [], shape = null, landing = 'feet' } = {}) {
  const totalHalfTwists = halfTwistsPerSom.reduce((s, t) => s + (t || 0), 0);

  // Pure jumps / static landings (no rotation, no twist)
  if (quarterSoms === 0 && totalHalfTwists === 0) {
    if (landing === 'seat') return '--';
    if (landing === 'back') return '1-';
    if (landing === 'front') return '1-f';
    if (landing === 'feet') return SHAPE_TO_SYMBOL[shape] ?? '';
  }

  const quarterDigit = quarterSoms > 0 ? String(quarterSoms) : '-';

  const numEntries = Math.max(1, Math.ceil(quarterSoms / 4));
  const twistDigits = [];
  for (let i = 0; i < numEntries; i++) {
    const t = halfTwistsPerSom[i] || 0;
    twistDigits.push(t === 0 ? '-' : String(t));
  }
  const twistsPart = twistDigits.join('');

  let suffix = '';
  if (landing === 'seat') suffix = '--';
  else if (landing === 'front') suffix = 'f';
  else if (landing === 'back' && totalHalfTwists > 0) suffix = '-'; // only when twists are present
  else if (landing === 'feet' && quarterSoms > 0) suffix = SHAPE_TO_SYMBOL[shape] ?? '';

  return quarterDigit + twistsPart + suffix;
}

// Suggested name from structured params. Falls back to a descriptive
// composite when no canonical alias matches.
function suggestName({ quarterSoms = 0, halfTwistsPerSom = [], shape = null, landing = 'feet', direction = 'backward' } = {}) {
  const totalHalfTwists = halfTwistsPerSom.reduce((s, t) => s + (t || 0), 0);
  const completeSoms = Math.floor(quarterSoms / 4);
  const shapeName = shape ? shape[0].toUpperCase() + shape.slice(1) : '';
  const shapeSuffix = shape ? ` (${shape[0].toUpperCase()})` : '';

  // Pure jumps / landings
  if (quarterSoms === 0 && totalHalfTwists === 0) {
    if (landing === 'feet' && shape) return `${shapeName} Jump`;
    if (landing === 'seat') return 'Seat Landing';
    if (landing === 'back') return 'Back Landing';
    if (landing === 'front') return 'Front Landing';
  }
  if (quarterSoms === 0 && totalHalfTwists > 0) {
    return totalHalfTwists === 1 ? '½ Twist' : `${totalHalfTwists / 2} Twist`;
  }

  // Canonical aliases
  if (quarterSoms === 4 && totalHalfTwists === 1 && direction === 'forward' && landing === 'feet') return `Barani${shapeSuffix}`;
  if (quarterSoms === 4 && totalHalfTwists === 2 && direction === 'backward' && shape === 'straight' && landing === 'feet') return 'Full';
  if (quarterSoms === 4 && totalHalfTwists === 3 && direction === 'backward' && shape === 'straight' && landing === 'feet') return 'Rudi';
  if (quarterSoms === 4 && totalHalfTwists === 2 && direction === 'forward' && shape === 'straight' && landing === 'feet') return 'Full Front';
  if (quarterSoms === 4 && totalHalfTwists === 4 && shape === 'straight' && landing === 'feet') return 'Double Full';

  // Multi-som descriptive
  const somWord = ['', 'Single', 'Double', 'Triple', 'Quadruple'][completeSoms] || `${completeSoms}-som`;
  const dirWord = direction === 'forward' ? 'Front' : 'Back';
  if (quarterSoms % 4 === 0 && totalHalfTwists === 0 && landing === 'feet') {
    return `${somWord} ${dirWord}${shapeSuffix}`.trim();
  }
  if (quarterSoms === 3 && totalHalfTwists === 0 && landing === 'feet') {
    return `¾ ${dirWord}${shapeSuffix}`;
  }
  if (quarterSoms === 5 && totalHalfTwists === 0 && landing === 'feet') {
    return `1¼ ${dirWord} S/S${shapeSuffix}`;
  }
  if (quarterSoms === 7 && totalHalfTwists === 0 && landing === 'feet') {
    return `1¾ ${dirWord} S/S${shapeSuffix}`;
  }

  // Generic composite fallback
  const parts = [];
  if (quarterSoms > 0) parts.push(`${quarterSoms / 4} som`);
  if (totalHalfTwists > 0) parts.push(`${totalHalfTwists / 2}-twist`);
  if (shape) parts.push(shape);
  parts.push(`(land ${landing})`);
  return parts.join(' ');
}

function computeFigDifficulty(params = {}) {
  const { difficulty, breakdown } = computeDifficulty(params);
  const figNotation = computeFigNotation(params);
  const suggestedName = suggestName(params);
  return { difficulty, figNotation, suggestedName, breakdown };
}

module.exports = { computeFigDifficulty, computeDifficulty, computeFigNotation, suggestName };
