/**
 * Seed FIG difficulty scores and notations for all competition skills.
 * Run with: DATABASE_URL=... node scripts/seed-skill-difficulty.js
 *
 * Formula (FIG Trampoline Code of Points):
 *   - Each ¼ somersault = 0.1
 *   - +0.1 bonus per complete somersault
 *   - Each ½ twist = 0.1 (replaces shape bonus when present)
 *   - Pike or straight shape = +0.1 when no twist
 *
 * FIG notation: [quarterSoms][halfTwists per som...][position]
 *   Positions: o=tuck, <=pike, v=straddle, /=straight, --=seat, 1-=back, 1-f=front
 *   Use - for zero twists. No spaces.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Skills with difficulty values. Null entries are non-competition skills.
const SKILL_DATA = [
  // --- Basic jumps ---
  { name: 'Tuck Jump',     difficulty: 0.1, figNotation: 'o' },
  { name: 'Pike Jump',     difficulty: 0.1, figNotation: '<' },
  { name: 'Straddle Jump', difficulty: 0.1, figNotation: 'v' },

  // --- Basic twists (no somersault) ---
  { name: '½ Twist',  difficulty: 0.1, figNotation: '-1' },
  { name: 'Full Twist', difficulty: 0.2, figNotation: '-2' },

  // --- Landing positions ---
  { name: 'Seat Landing',  difficulty: 0.1, figNotation: '--' },
  { name: 'Front Landing', difficulty: 0.1, figNotation: '1-f' },
  { name: 'Back Landing',  difficulty: 0.1, figNotation: '1-' },
  { name: '½ to Front',   difficulty: 0.1, figNotation: '1-f' },
  { name: '½ to Back',    difficulty: 0.1, figNotation: '1-' },

  // --- Seat combinations ---
  { name: 'Seat ½ Twist to Feet', difficulty: 0.1, figNotation: '-1' },
  { name: 'Swivelhips',           difficulty: 0.1, figNotation: '-1--' },
  { name: '½ Twist to Seat',      difficulty: 0.2, figNotation: '11--' },
  { name: 'Seat to Front',        difficulty: 0.1, figNotation: '1-f' },
  { name: 'Front to Seat',        difficulty: 0.1, figNotation: '1-f' },

  // --- ½ somersault combinations ---
  { name: '½ Twist to Front',     difficulty: 0.2, figNotation: '11f' },
  { name: 'Back ½ Twist to Feet', difficulty: 0.2, figNotation: '11' },
  { name: 'Front ½ to Feet',      difficulty: 0.2, figNotation: '11' },
  { name: 'Back to Front',        difficulty: 0.2, figNotation: '2-f' },
  { name: 'Front to Back',        difficulty: 0.2, figNotation: '2-' },

  // --- Full-twist combinations (¾–1 somersault range) ---
  { name: 'Back Full Twist to Feet',  difficulty: 0.3, figNotation: '12' },
  { name: 'Front Full Twist to Feet', difficulty: 0.3, figNotation: '12' },
  { name: 'Back Full Twist to Front', difficulty: 0.4, figNotation: '22f' },
  { name: 'Front Full Twist to Back', difficulty: 0.4, figNotation: '22' },

  // --- ¾ somersaults ---
  { name: '¾ Front (S)', difficulty: 0.3, figNotation: '3-/' },
  { name: '¾ Back (T)',  difficulty: 0.3, figNotation: '3-o' },
  { name: '¾ Back (P)',  difficulty: 0.3, figNotation: '3-<' },
  { name: '¾ Back (S)',  difficulty: 0.3, figNotation: '3-/' },

  // --- ½ Twist to ¾ front ---
  { name: '½ Twist to ¾ Front (S)', difficulty: 0.4, figNotation: '31/' },
  { name: 'Barani to Front',         difficulty: 0.4, figNotation: '31/' },

  // --- Full twisting ¾ front ---
  { name: 'Full Twisting ¾ Front', difficulty: 0.5, figNotation: '32/' },

  // --- Bounce roll (from back, full somersault, back to back) ---
  { name: 'Bounce Roll (T)', difficulty: 0.5, figNotation: '4-o' },
  { name: 'Bounce Roll (P)', difficulty: 0.6, figNotation: '4-<' },

  // --- Single back somersaults ---
  { name: 'Back Somersault (T)',        difficulty: 0.5, figNotation: '4-o' },
  { name: 'Back Somersault (P)',        difficulty: 0.6, figNotation: '4-<' },
  { name: 'Back Somersault (S)',        difficulty: 0.6, figNotation: '4-/' },
  { name: 'Back Somersault (T) to Seat', difficulty: 0.5, figNotation: '4---' },

  // --- Single front somersaults ---
  { name: 'Front Somersault (T)', difficulty: 0.5, figNotation: '4-o' },
  { name: 'Front Somersault (P)', difficulty: 0.6, figNotation: '4-<' },

  // --- Barani (front + ½ twist) ---
  { name: 'Barani (T)', difficulty: 0.6, figNotation: '41o' },
  { name: 'Barani (P)', difficulty: 0.7, figNotation: '41<' },
  { name: 'Barani (S)', difficulty: 0.7, figNotation: '41/' },

  // --- Full (back + full twist) ---
  { name: 'Full', difficulty: 0.7, figNotation: '42/' },

  // --- Rudi (back + 1½ twist) ---
  { name: 'Rudi', difficulty: 0.8, figNotation: '43/' },

  // --- Full front ---
  { name: 'Full Front', difficulty: 0.7, figNotation: '42/' },

  // --- Full twisting bounce roll ---
  { name: 'Full Twisting Bounce Roll', difficulty: 0.7, figNotation: '42/' },

  // --- 1¼ back (Cody direction) ---
  { name: '1¼ Back S/S (T)', difficulty: 0.6, figNotation: '5-o' },
  { name: '1¼ Back S/S (P)', difficulty: 0.7, figNotation: '5-<' },
  { name: '1¼ Back S/S (S)', difficulty: 0.7, figNotation: '5-/' },

  // --- 1¼ front ---
  { name: '1¼ Front S/S (T)', difficulty: 0.6, figNotation: '5-o' },
  { name: '1¼ Front S/S (P)', difficulty: 0.7, figNotation: '5-<' },

  // --- Cody (from front landing, 1¼ backward) ---
  { name: 'Cody (T)', difficulty: 0.6, figNotation: '5-o' },
  { name: 'Cody (P)', difficulty: 0.7, figNotation: '5-<' },
  { name: 'Cody (S)', difficulty: 0.7, figNotation: '5-/' },

  // --- Ball-out Barani (from seat/back, 1¼ forward + ½ twist) ---
  { name: 'Ball-out Barani (T)', difficulty: 0.7, figNotation: '51o' },
  { name: 'Ball-out Barani (P)', difficulty: 0.7, figNotation: '51<' },
  { name: 'Ball-out Barani (S)', difficulty: 0.7, figNotation: '51/' },

  // --- Barani Ball-out (Barani then ball-out — 1¼ forward + ½ twist) ---
  { name: 'Barani Ball-out (T)', difficulty: 0.7, figNotation: '51o' },

  // --- Barani to back ---
  { name: 'Barani to Back', difficulty: 0.7, figNotation: '41-' },

  // --- Full twisting Cody ---
  { name: 'Full Twisting Cody', difficulty: 0.8, figNotation: '52/' },

  // --- 1¾ front ---
  { name: '1¾ Front S/S (T)', difficulty: 0.8, figNotation: '7-o' },
  { name: '1¾ Front S/S (P)', difficulty: 0.9, figNotation: '7-<' },

  // --- Ball-out Rudi ---
  { name: 'Ball-out Rudi (T)', difficulty: 0.9, figNotation: '53o' },
  { name: 'Ball-out Rudi (P)', difficulty: 0.9, figNotation: '53<' },
  { name: 'Ball-out Rudi (S)', difficulty: 0.9, figNotation: '53/' },

  // --- Double Full (single back with 4 half-twists = 2 full twists) ---
  { name: 'Double Full',      difficulty: 0.9, figNotation: '44/' },
  { name: 'Double Full Back', difficulty: 0.9, figNotation: '44/' },

  // --- Double back somersaults ---
  { name: 'Double Back (T)',  difficulty: 1.1, figNotation: '8--o' },
  { name: 'Double Back(P)',   difficulty: 1.3, figNotation: '8--<' },  // no space — matches DB name
  { name: 'Double Back (S)',  difficulty: 1.3, figNotation: '8--/' },

  // --- Half-out ---
  { name: 'Half Out (T)', difficulty: 1.1, figNotation: '8-1o' },
  { name: 'Half Out (P)', difficulty: 1.3, figNotation: '8-1<' },

  // --- Non-competition skills (no difficulty) ---
  // 5x Back Bounces, Backward Roll, Cat Twist, Forward Roll, Forward Turnover,
  // Log Roll, Back Pullover, Roller, ½ Turntable, Cradle, Cruise, Corkscrew,
  // Forkscrew, Seat ½ to Back, Back ½ to Seat — left at null.
];

async function main() {
  console.log(`Seeding difficulty for ${SKILL_DATA.length} skills...`);

  let updated = 0;
  let notFound = [];

  for (const { name, difficulty, figNotation } of SKILL_DATA) {
    const result = await prisma.skill.updateMany({
      where: { name },
      data: { difficulty, figNotation },
    });
    if (result.count === 0) {
      notFound.push(name);
    } else {
      updated += result.count;
    }
  }

  console.log(`Updated ${updated} skill record(s).`);
  if (notFound.length > 0) {
    console.warn('Skills not found in DB:', notFound);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
