/**
 * Finalize the legacy-skill backfill in one pass:
 *   - Apply structured params to skills with figNotation (parsed from notation + name).
 *   - Apply structured params to the 11 keep-cases the user specified for ambiguous names.
 *   - Merge 4 duplicates into existing library entries: repoint level_skills,
 *     routine_skills, skill_progress; delete the duplicate Skill row.
 *
 * Run --analyse first to see what will change, --apply to write.
 *
 *   DATABASE_URL=... node scripts/finalize-skill-backfill.js --analyse
 *   DATABASE_URL=... node scripts/finalize-skill-backfill.js --apply
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Reuse the parser from the prior analysis script ─────────────────────────
const SHAPE_FROM_SUFFIX = { o: 'tuck', '<': 'pike', '/': 'straight', v: 'straddle' };

function parseFig(fig) {
  if (!fig) return null;
  if (fig === 'o') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'tuck',     landing: 'feet' };
  if (fig === '<') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'pike',     landing: 'feet' };
  if (fig === '/') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'straight', landing: 'feet' };
  if (fig === 'v') return { quarterSoms: 0, halfTwistsPerSom: '', shape: 'straddle', landing: 'feet' };
  if (fig === '--')  return { quarterSoms: 0, halfTwistsPerSom: '',  shape: null, landing: 'seat'  };
  if (fig === '1-')  return { quarterSoms: 1, halfTwistsPerSom: '-', shape: null, landing: 'back'  };
  if (fig === '1-f') return { quarterSoms: 1, halfTwistsPerSom: '-', shape: null, landing: 'front' };
  if (fig.startsWith('-')) {
    if (fig.endsWith('--') && fig.length >= 4) {
      return { quarterSoms: 0, halfTwistsPerSom: fig.slice(1, -2), shape: null, landing: 'seat' };
    }
    const t = fig.slice(1);
    if (/^[\d-]+$/.test(t)) return { quarterSoms: 0, halfTwistsPerSom: t, shape: null, landing: 'feet' };
    return null;
  }
  const quarterSoms = parseInt(fig.charAt(0));
  if (Number.isNaN(quarterSoms)) return null;
  const completeSoms = Math.floor(quarterSoms / 4);
  const expectedTwistChars = Math.max(1, completeSoms);
  const rest = fig.slice(1);
  const twistsPart = rest.slice(0, expectedTwistChars);
  const suffix = rest.slice(expectedTwistChars);
  if (!/^[-\d]+$/.test(twistsPart)) return null;
  let shape = null, landing = 'feet';
  if (suffix === 'o' || suffix === '<' || suffix === '/' || suffix === 'v') shape = SHAPE_FROM_SUFFIX[suffix];
  else if (suffix === '--') landing = 'seat';
  else if (suffix === 'f')  landing = 'front';
  else if (suffix === '-')  landing = 'back';
  return { quarterSoms, halfTwistsPerSom: twistsPart, shape, landing };
}

function inferDirection(name) {
  const n = name.toLowerCase();
  if (/\bfront\s+(som|full|half|landing|to|½|\d|s\/?s)/i.test(n)) return 'forward';
  if (/\bfront\s*½/i.test(n)) return 'forward';
  if (/full\s+front\b/i.test(n)) return 'forward';
  if (/\bbarani\b|ball-?out|half\s*out|rudy\s*out|randy\s*out|full\s*half|full\s*rudy|full\s*randy|3\s*½\s*out|forward\s*roll|forward\s*turnover|log\s*roll|seat\s*to\s*front|front\s*to/i.test(n)) return 'forward';
  if (/¾\s*front|1\s*¼\s*front|1\s*¾\s*front|2\s*¾\s*front/i.test(n)) return 'forward';
  if (/to\s*front\b/i.test(n) && !/back\s.*to\s*front/i.test(n)) return 'forward';
  if (/\bback\s+(som|full|half|landing|to|½|\d|s\/?s)/i.test(n)) return 'backward';
  if (/cody|\brudi\b|\brudolph\b|\brandolph\b|bounce\s*roll|double\s*full|triple\s*full|quadruple\s*full|swivelhips|cat\s*twist|cradle|cruise|corkscrew|forkscrew|pullover|backward\s*roll/i.test(n)) return 'backward';
  if (/¾\s*back|1\s*¼\s*back|1\s*¾\s*back|2\s*¾\s*back|triple\s*back|double\s*back/i.test(n)) return 'backward';
  if (/^full$/i.test(n.trim())) return 'backward';
  if (/to\s*back\b/i.test(n)) return 'backward';
  return 'backward'; // fallback
}

// ─── User-specified overrides (the 11 keep-cases) ────────────────────────────
// Keyed on existing skill name (case-sensitive). Values are the structured params.
const KEEP_CASES = {
  'Full Out (P)':                { figNotation: '8-2<',  difficulty: 1.4, quarterSoms: 8, halfTwistsPerSom: '-2', shape: 'pike',     landing: 'feet', direction: 'forward'  },
  'Full Out (S)':                { figNotation: '8-2/',  difficulty: 1.4, quarterSoms: 8, halfTwistsPerSom: '-2', shape: 'straight', landing: 'feet', direction: 'forward'  },
  'Full In (P)':                 { figNotation: '82-<',  difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '2-', shape: 'pike',     landing: 'feet', direction: 'backward' },
  'Full In (S)':                 { figNotation: '82-/',  difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '2-', shape: 'straight', landing: 'feet', direction: 'backward' },
  'Full In, Back Out (T)':       { figNotation: '82-o',  difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '2-', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  'Barani in, Back out (T)':     { figNotation: '81-o',  difficulty: 1.1, quarterSoms: 8, halfTwistsPerSom: '1-', shape: 'tuck',     landing: 'feet', direction: 'forward'  },
  'Barani in, Back out (P)':     { figNotation: '81-<',  difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '1-', shape: 'pike',     landing: 'feet', direction: 'forward'  },
  'Barani in, Back out (S)':     { figNotation: '81-/',  difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '1-', shape: 'straight', landing: 'feet', direction: 'forward'  },
  'Double back, Half out (T)':   { figNotation: '8-1o',  difficulty: 1.2, quarterSoms: 8, halfTwistsPerSom: '-1', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  'Double Back, Half out (P)':   { figNotation: '8-1<',  difficulty: 1.4, quarterSoms: 8, halfTwistsPerSom: '-1', shape: 'pike',     landing: 'feet', direction: 'backward' },
  'Double Back, Half Out (S)':   { figNotation: '8-1/',  difficulty: 1.4, quarterSoms: 8, halfTwistsPerSom: '-1', shape: 'straight', landing: 'feet', direction: 'backward' },
};

// ─── Merge plan: duplicate name → keeper figNotation ─────────────────────────
// For each merge, the duplicate Skill is deleted; references are repointed to
// the library skill identified by the keeper figNotation.
const MERGES = [
  { duplicateName: 'Half out (S)',     keeperFig: '8-1/' },
  { duplicateName: 'Back in, Full (T)', keeperFig: '8-2o' },
  { duplicateName: '½ In ½ Out (P)',   keeperFig: '811<' },
  { duplicateName: '½ In ½ Out (S)',   keeperFig: '811/' },
];

async function main() {
  const apply = process.argv.includes('--apply');

  // 1) Find the keepers for merges (by FIG notation)
  const keepers = {};
  for (const m of MERGES) {
    const k = await prisma.skill.findFirst({ where: { figNotation: m.keeperFig } });
    if (!k) {
      console.error(`!! No keeper found for ${m.duplicateName} (figNotation=${m.keeperFig})`);
      process.exit(1);
    }
    keepers[m.duplicateName] = k.id;
  }

  // 2) Skills that need structured params
  const skills = await prisma.skill.findMany({ where: { quarterSoms: null } });
  const updates = [];        // { id, name, params }
  const skipNonComp = [];    // names left null
  const dupes = [];          // { dupId, dupName, keeperId, keeperFig }
  const NON_COMP_PATTERNS = /(roll|cradle|cruise|corkscrew|forkscrew|pullover|cat\s*twist|turntable|bounces|seat\s*½|back\s*½\s*to\s*seat|forward\s*turnover)/i;

  for (const s of skills) {
    const merge = MERGES.find(m => m.duplicateName === s.name);
    if (merge) {
      dupes.push({ dupId: s.id, dupName: s.name, keeperId: keepers[s.name], keeperFig: merge.keeperFig });
      continue;
    }
    if (KEEP_CASES[s.name]) {
      updates.push({ id: s.id, name: s.name, params: KEEP_CASES[s.name] });
      continue;
    }
    if (s.figNotation) {
      const parsed = parseFig(s.figNotation);
      if (!parsed) continue;
      updates.push({ id: s.id, name: s.name, params: { ...parsed, direction: inferDirection(s.name) } });
      continue;
    }
    if (NON_COMP_PATTERNS.test(s.name)) skipNonComp.push(s.name);
  }

  console.log(`\nUpdates: ${updates.length}`);
  console.log(`Merges:  ${dupes.length}`);
  console.log(`Non-comp left null: ${skipNonComp.length}`);

  if (!apply) {
    console.log(`\n(dry run — re-run with --apply)`);
    return;
  }

  // 3) Apply structured params
  for (const u of updates) {
    const data = {
      quarterSoms: u.params.quarterSoms,
      halfTwistsPerSom: u.params.halfTwistsPerSom,
      shape: u.params.shape,
      landing: u.params.landing,
      direction: u.params.direction,
    };
    if (u.params.figNotation && !data.figNotation) data.figNotation = u.params.figNotation;
    if (u.params.difficulty != null) data.difficulty = u.params.difficulty;
    await prisma.skill.update({ where: { id: u.id }, data });
  }
  console.log(`✓ Updated ${updates.length} skill(s) with structured params.`);

  // 4) Apply merges. For each duplicate:
  //    - move level_skills, routine_skills, skill_progress to the keeper
  //    - resolve unique-constraint conflicts by deleting the duplicate's row
  //    - delete the duplicate Skill
  for (const { dupId, dupName, keeperId } of dupes) {
    await prisma.$transaction(async (tx) => {
      const tables = [
        { table: 'levelSkill',     keyCol: 'levelId' },
        { table: 'routineSkill',   keyCol: 'routineId' },
        { table: 'skillProgress',  keyCol: 'gymnastId' },
      ];
      for (const { table, keyCol } of tables) {
        const dupRows = await tx[table].findMany({ where: { skillId: dupId } });
        for (const row of dupRows) {
          const conflict = await tx[table].findFirst({ where: { [keyCol]: row[keyCol], skillId: keeperId } });
          if (conflict) {
            // keeper already has a row for this parent → drop the duplicate's row
            await tx[table].delete({ where: { id: row.id } });
          } else {
            await tx[table].update({ where: { id: row.id }, data: { skillId: keeperId } });
          }
        }
      }
      await tx.skill.delete({ where: { id: dupId } });
    });
    console.log(`✓ Merged "${dupName}" → keeper ${keeperId}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
