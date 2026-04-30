const { computeFigDifficulty } = require('../figDifficulty');

// Each case mirrors a row from backend/scripts/seed-skill-difficulty.js.
// The structured params here should be the canonical interpretation of the named skill.
// Difficulty values are authoritative (FIG §17.1). Notation strings are best-effort —
// a small number of seed entries may differ; coaches override on a per-skill basis.

describe('computeFigDifficulty — seed-data difficulty values', () => {
  const cases = [
    // Pure jumps
    ['Tuck Jump',     { quarterSoms: 0, halfTwistsPerSom: [], shape: 'tuck',     landing: 'feet', direction: 'backward' }, 0.1, 'o'],
    ['Pike Jump',     { quarterSoms: 0, halfTwistsPerSom: [], shape: 'pike',     landing: 'feet', direction: 'backward' }, 0.1, '<'],
    ['Straddle Jump', { quarterSoms: 0, halfTwistsPerSom: [], shape: 'straddle', landing: 'feet', direction: 'backward' }, 0.1, 'v'],

    // Pure twists
    ['½ Twist',  { quarterSoms: 0, halfTwistsPerSom: [1], landing: 'feet' }, 0.1, '-1'],
    ['Full Twist', { quarterSoms: 0, halfTwistsPerSom: [2], landing: 'feet' }, 0.2, '-2'],

    // Pure landings
    ['Seat Landing', { quarterSoms: 0, halfTwistsPerSom: [], landing: 'seat' }, 0.1, '--'],
    ['Back Landing', { quarterSoms: 0, halfTwistsPerSom: [], landing: 'back' }, 0.1, '1-'],
    ['Front Landing', { quarterSoms: 0, halfTwistsPerSom: [], landing: 'front' }, 0.1, '1-f'],

    // Single som — back
    ['Back Som (T)', { quarterSoms: 4, halfTwistsPerSom: [0], shape: 'tuck',     landing: 'feet', direction: 'backward' }, 0.5, '4-o'],
    ['Back Som (P)', { quarterSoms: 4, halfTwistsPerSom: [0], shape: 'pike',     landing: 'feet', direction: 'backward' }, 0.6, '4-<'],
    ['Back Som (S)', { quarterSoms: 4, halfTwistsPerSom: [0], shape: 'straight', landing: 'feet', direction: 'backward' }, 0.6, '4-/'],

    // Front som
    ['Front Som (T)', { quarterSoms: 4, halfTwistsPerSom: [0], shape: 'tuck', landing: 'feet', direction: 'forward' }, 0.5, '4-o'],

    // ¾ rotations
    ['¾ Back (T)', { quarterSoms: 3, halfTwistsPerSom: [0], shape: 'tuck',     landing: 'feet', direction: 'backward' }, 0.3, '3-o'],
    ['¾ Back (P)', { quarterSoms: 3, halfTwistsPerSom: [0], shape: 'pike',     landing: 'feet', direction: 'backward' }, 0.3, '3-<'],
    ['¾ Front (S)', { quarterSoms: 3, halfTwistsPerSom: [0], shape: 'straight', landing: 'feet', direction: 'forward' }, 0.3, '3-/'],

    // Twisting singles
    ['Barani (T)',  { quarterSoms: 4, halfTwistsPerSom: [1], shape: 'tuck',     landing: 'feet', direction: 'forward' }, 0.6, '41o'],
    ['Barani (P)',  { quarterSoms: 4, halfTwistsPerSom: [1], shape: 'pike',     landing: 'feet', direction: 'forward' }, 0.7, '41<'],
    ['Barani (S)',  { quarterSoms: 4, halfTwistsPerSom: [1], shape: 'straight', landing: 'feet', direction: 'forward' }, 0.7, '41/'],
    ['Full',        { quarterSoms: 4, halfTwistsPerSom: [2], shape: 'straight', landing: 'feet', direction: 'backward' }, 0.7, '42/'],
    ['Rudi',        { quarterSoms: 4, halfTwistsPerSom: [3], shape: 'straight', landing: 'feet', direction: 'backward' }, 0.8, '43/'],
    ['Double Full', { quarterSoms: 4, halfTwistsPerSom: [4], shape: 'straight', landing: 'feet', direction: 'backward' }, 0.9, '44/'],

    // Doubles — straight backward
    ['Double Back (T)', { quarterSoms: 8, halfTwistsPerSom: [0, 0], shape: 'tuck',     landing: 'feet', direction: 'backward' }, 1.1, '8--o'],
    ['Double Back (P)', { quarterSoms: 8, halfTwistsPerSom: [0, 0], shape: 'pike',     landing: 'feet', direction: 'backward' }, 1.3, '8--<'],
    ['Double Back (S)', { quarterSoms: 8, halfTwistsPerSom: [0, 0], shape: 'straight', landing: 'feet', direction: 'backward' }, 1.3, '8--/'],

    // Half-out (double back with ½ twist on second som)
    ['Half Out (T)', { quarterSoms: 8, halfTwistsPerSom: [0, 1], shape: 'tuck', landing: 'feet', direction: 'backward' }, 1.1, '8-1o'],
    ['Half Out (P)', { quarterSoms: 8, halfTwistsPerSom: [0, 1], shape: 'pike', landing: 'feet', direction: 'backward' }, 1.3, '8-1<'],

    // ½ rotations to non-feet landings
    ['Back to Front', { quarterSoms: 2, halfTwistsPerSom: [0], landing: 'front', direction: 'backward' }, 0.2, '2-f'],
    ['Front to Back', { quarterSoms: 2, halfTwistsPerSom: [0], landing: 'back',  direction: 'forward'  }, 0.2, '2-'],

    // Combinations to feet via ¼ rotations
    ['Back ½ Twist to Feet', { quarterSoms: 1, halfTwistsPerSom: [1], landing: 'feet' }, 0.2, '11'],
    ['Back Full to Feet',    { quarterSoms: 1, halfTwistsPerSom: [2], landing: 'feet' }, 0.3, '12'],

    // Bounce roll (T = single back tuck back-to-back)
    ['Bounce Roll (T)', { quarterSoms: 4, halfTwistsPerSom: [0], shape: 'tuck', landing: 'feet', direction: 'backward' }, 0.5, '4-o'],
  ];

  for (const [label, params, expectedDiff, expectedFig] of cases) {
    test(`${label}: difficulty=${expectedDiff}, fig=${expectedFig}`, () => {
      const out = computeFigDifficulty(params);
      expect(out.difficulty).toBe(expectedDiff);
      expect(out.figNotation).toBe(expectedFig);
    });
  }
});

describe('computeFigDifficulty — breakdown captions', () => {
  test('Double back tuck shows somersault, completion bonus, backward bonus', () => {
    const out = computeFigDifficulty({
      quarterSoms: 8, halfTwistsPerSom: [0, 0], shape: 'tuck', landing: 'feet', direction: 'backward',
    });
    const labels = out.breakdown.map(b => b.label);
    expect(labels).toContain('8 × ¼ som (§17.1.1.1)');
    expect(labels).toContain('2-som completion bonus (§17.1.1)');
    expect(labels).toContain('Backward 2-som (§17.1.6.1)');
  });

  test('Pure jump uses §17.1.2', () => {
    const out = computeFigDifficulty({
      quarterSoms: 0, halfTwistsPerSom: [], shape: 'tuck', landing: 'feet',
    });
    expect(out.breakdown[0].label).toBe('Base jump (§17.1.2)');
  });
});

describe('suggestName', () => {
  test('Barani tuck (forward + ½ twist + tuck)', () => {
    const out = computeFigDifficulty({
      quarterSoms: 4, halfTwistsPerSom: [1], shape: 'tuck', landing: 'feet', direction: 'forward',
    });
    expect(out.suggestedName).toBe('Barani (T)');
  });

  test('Double back pike', () => {
    const out = computeFigDifficulty({
      quarterSoms: 8, halfTwistsPerSom: [0, 0], shape: 'pike', landing: 'feet', direction: 'backward',
    });
    expect(out.suggestedName).toBe('Double Back (P)');
  });
});
