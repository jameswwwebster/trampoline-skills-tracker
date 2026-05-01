/**
 * Backfill structured params (quarterSoms / halfTwistsPerSom / shape / landing /
 * direction) for skills that pre-date the FIG calculator. Run in --analyse mode
 * first to inspect; --apply writes the inferred values to the DB.
 *
 *   DATABASE_URL=... node scripts/backfill-skill-structured.js --analyse
 *   DATABASE_URL=... node scripts/backfill-skill-structured.js --apply
 *
 * The parser uses figNotation when present + name keywords for direction.
 * Skills it cannot infer with confidence are listed under UNCERTAIN.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAPE_FROM_SUFFIX = { o: 'tuck', '<': 'pike', '/': 'straight', v: 'straddle' };

// Parse the figNotation string into structured params (no direction — direction
// comes from the name). Returns null if the notation can't be confidently parsed.
function parseFig(fig) {
  if (!fig) return null;

  // Pure shape tokens (no rotation, no twist)
  if (fig === 'o') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'tuck',     landing: 'feet' };
  if (fig === '<') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'pike',     landing: 'feet' };
  if (fig === '/') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'straight', landing: 'feet' };
  if (fig === 'v') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'straddle', landing: 'feet' };

  // Pure landings
  if (fig === '--')  return { quarterSoms: 0, halfTwistsPerSom: '',  shape: null, landing: 'seat'  };
  if (fig === '1-')  return { quarterSoms: 1, halfTwistsPerSom: '-', shape: null, landing: 'back'  };
  if (fig === '1-f') return { quarterSoms: 1, halfTwistsPerSom: '-', shape: null, landing: 'front' };

  // Pure twist (starts with '-' meaning 0 quarters), e.g. -1, -2, -1--
  if (fig.startsWith('-')) {
    // -1--  Swivelhips (twist + seat landing)
    if (fig.endsWith('--') && fig.length >= 4) {
      const twistsPart = fig.slice(1, -2);
      return { quarterSoms: 0, halfTwistsPerSom: twistsPart, shape: null, landing: 'seat' };
    }
    const twistsPart = fig.slice(1);
    if (/^[\d-]+$/.test(twistsPart)) {
      return { quarterSoms: 0, halfTwistsPerSom: twistsPart, shape: null, landing: 'feet' };
    }
    return null;
  }

  // General: [quarterDigit][twistDigits...][suffix].
  // Slice based on expected twist count = ceil(quarterSoms/4) so '41-' parses
  // correctly as quarters=4, twists='1', suffix='-' (back landing) rather than
  // quarters=4, twists='1-', suffix=''.
  const quarterSoms = parseInt(fig.charAt(0));
  if (Number.isNaN(quarterSoms)) return null;
  // Twist chars = number of complete soms (one digit per som). 1-4 quarters
  // (partial up to 1 som) → 1 char; 5-8 → use floor(8/4)=2 chars only when
  // exactly at a complete som boundary; legacy notation pattern shows that
  // 5/6/7-quarter skills (1¼/1½/1¾) use a single twist char.
  const completeSoms = Math.floor(quarterSoms / 4);
  const expectedTwistChars = Math.max(1, completeSoms);
  const rest = fig.slice(1);
  const twistsPart = rest.slice(0, expectedTwistChars);
  const suffix = rest.slice(expectedTwistChars);
  if (!/^[-\d]+$/.test(twistsPart)) return null;

  let shape = null;
  let landing = 'feet';
  if (suffix === 'o' || suffix === '<' || suffix === '/' || suffix === 'v') {
    shape = SHAPE_FROM_SUFFIX[suffix];
  } else if (suffix === '--') {
    landing = 'seat';
  } else if (suffix === 'f') {
    landing = 'front';
  } else if (suffix === '-') {
    landing = 'back';
  }

  // Sanity-check twist length matches what we'd expect for the rotation
  return { quarterSoms, halfTwistsPerSom: twistsPart, shape, landing };
}

// Direction is the takeoff direction. Rules in priority order:
//   1. "front" followed by "full" / "som" / "½" / "to X" / a shape suffix → forward
//   2. forward-named skills (Barani, Ball-out, Rudy/Randy Out, Half Out, etc.) → forward
//   3. "to front" suffix on a non-back-prefix name → forward
//   4. "back" similarly → backward
//   5. "to back" → backward
//   6. backward-named (Cody, Rudi, Full alone, Bounce Roll, Double Full…) → backward
//   7. fallback: backward
function inferDirection(name) {
  const n = name.toLowerCase();

  // 1 + 2 — forward
  if (/\bfront\s+(som|full|half|landing|to|½|\d|s\/?s)/i.test(n)) return 'forward';
  if (/\bfront\s*½/i.test(n)) return 'forward';
  if (/full\s+front\b/i.test(n)) return 'forward';
  if (/\bbarani\b|ball-?out|half\s*out|rudy\s*out|randy\s*out|full\s*half|full\s*rudy|full\s*randy|3\s*½\s*out|forward\s*roll|forward\s*turnover|log\s*roll|seat\s*to\s*front|front\s*to/i.test(n)) {
    return 'forward';
  }
  if (/¾\s*front|1\s*¼\s*front|1\s*¾\s*front|2\s*¾\s*front/i.test(n)) return 'forward';
  // "to front" without an explicit Back prefix
  if (/to\s*front\b/i.test(n) && !/back\s.*to\s*front/i.test(n)) return 'forward';

  // 4 + 5 + 6 — backward
  if (/\bback\s+(som|full|half|landing|to|½|\d|s\/?s)/i.test(n)) return 'backward';
  if (/cody|\brudi\b|\brudolph\b|\brandolph\b|bounce\s*roll|double\s*full|triple\s*full|quadruple\s*full|swivelhips|cat\s*twist|cradle|cruise|corkscrew|forkscrew|pullover|backward\s*roll/i.test(n)) {
    return 'backward';
  }
  if (/¾\s*back|1\s*¼\s*back|1\s*¾\s*back|2\s*¾\s*back|triple\s*back|double\s*back/i.test(n)) return 'backward';
  // Bare "Full" alone (Back full single som)
  if (/^full$/i.test(n.trim())) return 'backward';
  if (/to\s*back\b/i.test(n)) return 'backward';

  return null;
}

// Default direction for landings/jumps that have no rotation-direction implication.
function fallbackDirection(parsed) {
  // Pure jump / landing → backward (consistent with how seed treats them)
  if (parsed.quarterSoms === 0) return 'backward';
  return 'backward';
}

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'analyse';
  const skills = await prisma.skill.findMany({
    where: { quarterSoms: null },
    orderBy: [{ figNotation: 'asc' }, { name: 'asc' }],
  });

  const confident = [];
  const noFigNoStructure = []; // non-competition skills (rolls, cradles etc.)
  const uncertain = [];

  for (const s of skills) {
    if (!s.figNotation) {
      // No FIG notation. Either non-competition or imported-with-no-notation.
      // Mark for human review unless the name is clearly non-competition.
      if (/(roll|cradle|cruise|corkscrew|forkscrew|pullover|cat\s*twist|turntable|bounces|seat\s*½|back\s*½\s*to\s*seat)/i.test(s.name)) {
        noFigNoStructure.push(s);
      } else {
        uncertain.push({ skill: s, reason: 'no figNotation' });
      }
      continue;
    }

    const parsed = parseFig(s.figNotation);
    if (!parsed) {
      uncertain.push({ skill: s, reason: 'unparseable figNotation' });
      continue;
    }
    let direction = inferDirection(s.name);
    if (!direction) direction = fallbackDirection(parsed);

    confident.push({ skill: s, params: { ...parsed, direction } });
  }

  console.log(`\n==== CONFIDENT (${confident.length}) ====`);
  for (const { skill, params } of confident) {
    console.log(`  ${skill.figNotation.padEnd(8)}  ${skill.name.padEnd(36)} → q=${params.quarterSoms} t='${params.halfTwistsPerSom}' shape=${params.shape || '—'} land=${params.landing} dir=${params.direction}`);
  }

  console.log(`\n==== NON-COMPETITION / NO ROTATION (${noFigNoStructure.length}) ====`);
  for (const s of noFigNoStructure) {
    console.log(`  ${s.name}`);
  }

  console.log(`\n==== UNCERTAIN — needs human input (${uncertain.length}) ====`);
  for (const { skill, reason } of uncertain) {
    console.log(`  ${skill.name.padEnd(36)} fig='${skill.figNotation || ''}'  ${reason}`);
  }

  console.log(`\nTotals: confident=${confident.length}, no-rotation=${noFigNoStructure.length}, uncertain=${uncertain.length}`);

  if (mode === 'apply') {
    console.log(`\nApplying to DB...`);
    let applied = 0;
    for (const { skill, params } of confident) {
      await prisma.skill.update({
        where: { id: skill.id },
        data: {
          quarterSoms: params.quarterSoms,
          halfTwistsPerSom: params.halfTwistsPerSom,
          shape: params.shape,
          landing: params.landing,
          direction: params.direction,
        },
      });
      applied += 1;
    }
    console.log(`  Updated ${applied} skill(s).`);
    console.log(`  Skipped ${noFigNoStructure.length + uncertain.length} (no rotation / uncertain).`);
  } else {
    console.log(`\n(Dry run — re-run with --apply to write the confident set to the DB.)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
