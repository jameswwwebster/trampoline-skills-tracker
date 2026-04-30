/**
 * Import named trampoline skills from FIG Code of Points 2025-2028 §II.C.
 * Skills are inserted into the library with structured params, FIG notation, and
 * difficulty pre-filled. They are NOT attached to any level — coaches add them
 * to their own levels via the lookup UI.
 *
 * Idempotent: skills already present (matched by figNotation) are skipped.
 *
 * Per club rules:
 *   - "Drop" → "Landing" (and we only have one Landing entry per landing position;
 *     the FIG shape variants 1-o / 1-< / 1-/ are skipped — covered by existing seed).
 *   - Barani (forward 41o/41</41/) and Back Som w/ ½ Twist (backward, same notation)
 *     coexist as separate entries.
 *
 * Run: DATABASE_URL=... node scripts/import-fig-skills.js [--dry]
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// FIG II.C named-skill table. Each entry has the canonical name, FIG notation
// ('-' substituted for 0), difficulty, plus structured params for the calculator.
// halfTwistsPerSom is encoded as the FIG digit string ('-' = 0, digits 1-9).
const FIG_SKILLS = [
  // ─── Single som — forward ────────────────────────────────────────────
  { name: 'Randolph (Randy)',          figNotation: '45/',  difficulty: 1.0, quarterSoms: 4, halfTwistsPerSom: '5', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: '3½ Twisting Front',         figNotation: '47/',  difficulty: 1.2, quarterSoms: 4, halfTwistsPerSom: '7', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: '4½ Twisting Front',         figNotation: '49/',  difficulty: 1.4, quarterSoms: 4, halfTwistsPerSom: '9', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Randolph Ballout',          figNotation: '55/',  difficulty: 1.1, quarterSoms: 5, halfTwistsPerSom: '5', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: '1¾ Front (S)',              figNotation: '7-/',  difficulty: 0.9, quarterSoms: 7, halfTwistsPerSom: '-', shape: 'straight', landing: 'feet', direction: 'forward' },

  // ─── Single som — backward ───────────────────────────────────────────
  { name: 'Triple Full',               figNotation: '46/',  difficulty: 1.1, quarterSoms: 4, halfTwistsPerSom: '6', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Quadruple Full',            figNotation: '48/',  difficulty: 1.3, quarterSoms: 4, halfTwistsPerSom: '8', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Cody with Double Twist',    figNotation: '54/',  difficulty: 1.0, quarterSoms: 5, halfTwistsPerSom: '4', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Back Somersault with ½ Twist (T)', figNotation: '41o', difficulty: 0.6, quarterSoms: 4, halfTwistsPerSom: '1', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Back Somersault with ½ Twist (P)', figNotation: '41<', difficulty: 0.6, quarterSoms: 4, halfTwistsPerSom: '1', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Back Somersault with ½ Twist (S)', figNotation: '41/', difficulty: 0.6, quarterSoms: 4, halfTwistsPerSom: '1', shape: 'straight', landing: 'feet', direction: 'backward' },

  // ─── Doubles — forward ───────────────────────────────────────────────
  { name: 'Half Out (S)',              figNotation: '8-1/', difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '-1', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Rudy Out (T)',              figNotation: '8-3o', difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '-3', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Rudy Out (P)',              figNotation: '8-3<', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '-3', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Rudy Out (S)',              figNotation: '8-3/', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '-3', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Full Half (T)',             figNotation: '821o', difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '21', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Full Half (P)',             figNotation: '821<', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '21', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Full Half (S)',             figNotation: '821/', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '21', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Full Rudy (T)',             figNotation: '823o', difficulty: 1.6, quarterSoms: 8, halfTwistsPerSom: '23', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Full Rudy (P)',             figNotation: '823<', difficulty: 1.8, quarterSoms: 8, halfTwistsPerSom: '23', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Full Rudy (S)',             figNotation: '823/', difficulty: 1.8, quarterSoms: 8, halfTwistsPerSom: '23', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Randy Out (T)',             figNotation: '8-5o', difficulty: 1.6, quarterSoms: 8, halfTwistsPerSom: '-5', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Randy Out (P)',             figNotation: '8-5<', difficulty: 1.8, quarterSoms: 8, halfTwistsPerSom: '-5', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Randy Out (S)',             figNotation: '8-5/', difficulty: 1.8, quarterSoms: 8, halfTwistsPerSom: '-5', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Full Randy (T)',            figNotation: '825o', difficulty: 2.0, quarterSoms: 8, halfTwistsPerSom: '25', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Full Randy (P)',            figNotation: '825<', difficulty: 2.2, quarterSoms: 8, halfTwistsPerSom: '25', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Full Randy (S)',            figNotation: '825/', difficulty: 2.2, quarterSoms: 8, halfTwistsPerSom: '25', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: '3½ Out (T)',                figNotation: '8-7o', difficulty: 2.0, quarterSoms: 8, halfTwistsPerSom: '-7', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: '3½ Out (P)',                figNotation: '8-7<', difficulty: 2.2, quarterSoms: 8, halfTwistsPerSom: '-7', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: '3½ Out (S)',                figNotation: '8-7/', difficulty: 2.2, quarterSoms: 8, halfTwistsPerSom: '-7', shape: 'straight', landing: 'feet', direction: 'forward' },

  // ─── Doubles — backward ──────────────────────────────────────────────
  { name: 'Half In Half Out (T)',      figNotation: '811o', difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '11', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half In Half Out (P)',      figNotation: '811<', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '11', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Half In Half Out (S)',      figNotation: '811/', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '11', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Back In Full Out (T)',      figNotation: '8-2o', difficulty: 1.3, quarterSoms: 8, halfTwistsPerSom: '-2', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Back In Full Out (P)',      figNotation: '8-2<', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '-2', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Back In Full Out (S)',      figNotation: '8-2/', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '-2', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: '1½ In Half Out (T)',        figNotation: '831o', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '31', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: '1½ In Half Out (P)',        figNotation: '831<', difficulty: 1.7, quarterSoms: 8, halfTwistsPerSom: '31', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Full In Full Out (T)',      figNotation: '822o', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '22', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Full In Full Out (S)',      figNotation: '822/', difficulty: 1.7, quarterSoms: 8, halfTwistsPerSom: '22', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Half In Rudy Out (T)',      figNotation: '813o', difficulty: 1.5, quarterSoms: 8, halfTwistsPerSom: '13', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half In Rudy Out (P)',      figNotation: '813<', difficulty: 1.7, quarterSoms: 8, halfTwistsPerSom: '13', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: '1½ In 1½ Out (T)',          figNotation: '833o', difficulty: 1.9, quarterSoms: 8, halfTwistsPerSom: '33', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: '1½ In 1½ Out (P)',          figNotation: '833<', difficulty: 2.1, quarterSoms: 8, halfTwistsPerSom: '33', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: '1½ In 1½ Out (S)',          figNotation: '833/', difficulty: 2.1, quarterSoms: 8, halfTwistsPerSom: '33', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Half In Randy Out (T)',     figNotation: '815o', difficulty: 1.9, quarterSoms: 8, halfTwistsPerSom: '15', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half In Randy Out (P)',     figNotation: '815<', difficulty: 2.1, quarterSoms: 8, halfTwistsPerSom: '15', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: '1½ In Randy Out (T)',       figNotation: '835o', difficulty: 2.3, quarterSoms: 8, halfTwistsPerSom: '35', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: '1½ In Randy Out (P)',       figNotation: '835<', difficulty: 2.5, quarterSoms: 8, halfTwistsPerSom: '35', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Double Full In Double Full Out', figNotation: '844/', difficulty: 2.5, quarterSoms: 8, halfTwistsPerSom: '44', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Half In 3½ Out (T)',        figNotation: '817o', difficulty: 2.3, quarterSoms: 8, halfTwistsPerSom: '17', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half In 3½ Out (P)',        figNotation: '817<', difficulty: 2.5, quarterSoms: 8, halfTwistsPerSom: '17', shape: 'pike',     landing: 'feet', direction: 'backward' },

  // ─── Triples — forward ───────────────────────────────────────────────
  { name: '2¾ Front (T)',              figNotation: '11--o', difficulty: 1.3, quarterSoms: 11, halfTwistsPerSom: '---', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: '2¾ Front (P)',              figNotation: '11--<', difficulty: 1.5, quarterSoms: 11, halfTwistsPerSom: '---', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: '2¾ Front (S)',              figNotation: '11--/', difficulty: 1.5, quarterSoms: 11, halfTwistsPerSom: '---', shape: 'straight', landing: 'feet', direction: 'forward' },
  { name: 'Front Front Half (T)',      figNotation: '12--1o', difficulty: 1.7, quarterSoms: 12, halfTwistsPerSom: '--1', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Front Front Half (P)',      figNotation: '12--1<', difficulty: 2.0, quarterSoms: 12, halfTwistsPerSom: '--1', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Front Front Rudy (T)',      figNotation: '12--3o', difficulty: 2.1, quarterSoms: 12, halfTwistsPerSom: '--3', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Front Front Rudy (P)',      figNotation: '12--3<', difficulty: 2.4, quarterSoms: 12, halfTwistsPerSom: '--3', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Full Front Half (T)',       figNotation: '122-1o', difficulty: 2.1, quarterSoms: 12, halfTwistsPerSom: '2-1', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Full Front Half (P)',       figNotation: '122-1<', difficulty: 2.4, quarterSoms: 12, halfTwistsPerSom: '2-1', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Front Full Half (T)',       figNotation: '12-21o', difficulty: 2.1, quarterSoms: 12, halfTwistsPerSom: '-21', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Front Full Half (P)',       figNotation: '12-21<', difficulty: 2.4, quarterSoms: 12, halfTwistsPerSom: '-21', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Full Front Rudy (T)',       figNotation: '122-3o', difficulty: 2.7, quarterSoms: 12, halfTwistsPerSom: '2-3', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Full Front Rudy (P)',       figNotation: '122-3<', difficulty: 3.0, quarterSoms: 12, halfTwistsPerSom: '2-3', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Front Full Rudy (T)',       figNotation: '12-23o', difficulty: 2.7, quarterSoms: 12, halfTwistsPerSom: '-23', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Front Full Rudy (P)',       figNotation: '12-23<', difficulty: 3.0, quarterSoms: 12, halfTwistsPerSom: '-23', shape: 'pike',     landing: 'feet', direction: 'forward' },
  { name: 'Full Full Half (T)',        figNotation: '12221o', difficulty: 2.7, quarterSoms: 12, halfTwistsPerSom: '221', shape: 'tuck',     landing: 'feet', direction: 'forward' },
  { name: 'Full Full Half (P)',        figNotation: '12221<', difficulty: 3.0, quarterSoms: 12, halfTwistsPerSom: '221', shape: 'pike',     landing: 'feet', direction: 'forward' },

  // ─── Triples — backward ──────────────────────────────────────────────
  { name: '2¾ Back with Half Twist (T)', figNotation: '111-o', difficulty: 1.5, quarterSoms: 11, halfTwistsPerSom: '11-', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: '2¾ Back with Half Twist (P)', figNotation: '111-<', difficulty: 1.7, quarterSoms: 11, halfTwistsPerSom: '11-', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: '2¾ Back with Half Twist (S)', figNotation: '111-/', difficulty: 1.7, quarterSoms: 11, halfTwistsPerSom: '11-', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Triple Back (T)',           figNotation: '12---o', difficulty: 1.8, quarterSoms: 12, halfTwistsPerSom: '---', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Triple Back (P)',           figNotation: '12---<', difficulty: 2.1, quarterSoms: 12, halfTwistsPerSom: '---', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Triple Back (S)',           figNotation: '12---/', difficulty: 2.1, quarterSoms: 12, halfTwistsPerSom: '---', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: 'Half Front Half (T)',       figNotation: '121-1o', difficulty: 2.0, quarterSoms: 12, halfTwistsPerSom: '1-1', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half Front Half (P)',       figNotation: '121-1<', difficulty: 2.3, quarterSoms: 12, halfTwistsPerSom: '1-1', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Half Front Rudy (T)',       figNotation: '121-3o', difficulty: 2.6, quarterSoms: 12, halfTwistsPerSom: '1-3', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half Front Rudy (P)',       figNotation: '121-3<', difficulty: 2.9, quarterSoms: 12, halfTwistsPerSom: '1-3', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Half Full Half (T)',        figNotation: '12121o', difficulty: 2.6, quarterSoms: 12, halfTwistsPerSom: '121', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Half Full Half (P)',        figNotation: '12121<', difficulty: 2.9, quarterSoms: 12, halfTwistsPerSom: '121', shape: 'pike',     landing: 'feet', direction: 'backward' },
  { name: 'Full Full Full (T)',        figNotation: '12222o', difficulty: 3.2, quarterSoms: 12, halfTwistsPerSom: '222', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: 'Full Full Full (S)',        figNotation: '12222/', difficulty: 3.5, quarterSoms: 12, halfTwistsPerSom: '222', shape: 'straight', landing: 'feet', direction: 'backward' },
  { name: '1½ Front Rudy Out (T)',     figNotation: '123-3o', difficulty: 3.2, quarterSoms: 12, halfTwistsPerSom: '3-3', shape: 'tuck',     landing: 'feet', direction: 'backward' },
  { name: '1½ Front Rudy Out (P)',     figNotation: '123-3<', difficulty: 3.5, quarterSoms: 12, halfTwistsPerSom: '3-3', shape: 'pike',     landing: 'feet', direction: 'backward' },

  // ─── Quadruples — forward ────────────────────────────────────────────
  { name: 'Front Front Front Half (T)', figNotation: '16---1o', difficulty: 2.5, quarterSoms: 16, halfTwistsPerSom: '---1', shape: 'tuck', landing: 'feet', direction: 'forward' },
  { name: 'Front Front Front Half (P)', figNotation: '16---1<', difficulty: 2.9, quarterSoms: 16, halfTwistsPerSom: '---1', shape: 'pike', landing: 'feet', direction: 'forward' },
  { name: 'Front Front Front Rudy (T)', figNotation: '16---3o', difficulty: 3.1, quarterSoms: 16, halfTwistsPerSom: '---3', shape: 'tuck', landing: 'feet', direction: 'forward' },
  { name: 'Front Front Front Rudy (P)', figNotation: '16---3<', difficulty: 3.5, quarterSoms: 16, halfTwistsPerSom: '---3', shape: 'pike', landing: 'feet', direction: 'forward' },

  // ─── Quadruples — backward ───────────────────────────────────────────
  { name: 'Half In Half Out Quadriffis (T)', figNotation: '161--1o', difficulty: 3.1, quarterSoms: 16, halfTwistsPerSom: '1--1', shape: 'tuck', landing: 'feet', direction: 'backward' },
  { name: 'Half In Half Out Quadriffis (P)', figNotation: '161--1<', difficulty: 3.5, quarterSoms: 16, halfTwistsPerSom: '1--1', shape: 'pike', landing: 'feet', direction: 'backward' },
  { name: 'Half In Rudy Out Quadriffis (T)', figNotation: '161--3o', difficulty: 3.7, quarterSoms: 16, halfTwistsPerSom: '1--3', shape: 'tuck', landing: 'feet', direction: 'backward' },
  { name: 'Half In Rudy Out Quadriffis (P)', figNotation: '161--3<', difficulty: 4.1, quarterSoms: 16, halfTwistsPerSom: '1--3', shape: 'pike', landing: 'feet', direction: 'backward' },
];

async function main() {
  const dryRun = process.argv.includes('--dry');
  const existing = await prisma.skill.findMany({ select: { figNotation: true } });
  const existingNotations = new Set(existing.map(s => s.figNotation).filter(Boolean));

  let inserted = 0;
  let skipped = 0;

  for (const entry of FIG_SKILLS) {
    if (existingNotations.has(entry.figNotation)) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[dry] would insert: ${entry.name} (${entry.figNotation}, ${entry.difficulty})`);
    } else {
      await prisma.skill.create({ data: entry });
    }
    inserted += 1;
  }

  console.log(`\nDone. ${dryRun ? 'Would insert' : 'Inserted'}: ${inserted}. Skipped (already present): ${skipped}.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
