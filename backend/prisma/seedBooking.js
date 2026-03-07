const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedSessionTemplates(clubId) {
  const templates = [
    { dayOfWeek: 2, startTime: '17:00', endTime: '18:00', openSlots: 12, minAge: null },
    { dayOfWeek: 2, startTime: '18:00', endTime: '19:00', openSlots: 12, minAge: null },
    { dayOfWeek: 3, startTime: '17:00', endTime: '18:00', openSlots: 12, minAge: null },
    { dayOfWeek: 3, startTime: '18:00', endTime: '19:00', openSlots: 12, minAge: null },
    { dayOfWeek: 4, startTime: '17:00', endTime: '18:00', openSlots: 12, minAge: null },
    { dayOfWeek: 4, startTime: '18:00', endTime: '19:00', openSlots: 12, minAge: null },
    { dayOfWeek: 4, startTime: '19:00', endTime: '20:00', openSlots: 12, minAge: 16 },
  ];

  for (const t of templates) {
    await prisma.sessionTemplate.create({
      data: { ...t, clubId },
    });
  }
  console.log(`Seeded ${templates.length} session templates for club ${clubId}`);
}

// Run directly: node prisma/seedBooking.js <clubId>
const clubId = process.argv[2];
if (!clubId) {
  console.error('Usage: node prisma/seedBooking.js <clubId>');
  process.exit(1);
}

seedBooking(clubId).catch(console.error).finally(() => prisma.$disconnect());

async function seedBooking(clubId) {
  // Check club exists
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new Error(`Club ${clubId} not found`);

  // Only seed if no templates exist for this club
  const existing = await prisma.sessionTemplate.count({ where: { clubId } });
  if (existing > 0) {
    console.log(`Club already has ${existing} templates, skipping seed`);
    return;
  }

  await seedSessionTemplates(clubId);
}

module.exports = { seedSessionTemplates };
