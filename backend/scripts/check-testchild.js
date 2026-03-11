const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gymnasts = await prisma.$queryRawUnsafe(
    'SELECT id, "firstName", "lastName", "userId" FROM gymnasts WHERE "firstName" ILIKE $1 AND "lastName" ILIKE $2',
    'Test', '%Child Two%'
  );
  console.log('Gymnast:', JSON.stringify(gymnasts, null, 2));

  if (gymnasts.length === 0) {
    // Try broader search
    const all = await prisma.$queryRawUnsafe(
      'SELECT id, "firstName", "lastName" FROM gymnasts WHERE "lastName" ILIKE $1', '%Two%'
    );
    console.log('Broader search:', JSON.stringify(all, null, 2));
    await prisma.$disconnect();
    return;
  }

  const gId = gymnasts[0].id;

  const memberships = await prisma.$queryRawUnsafe(
    'SELECT * FROM memberships WHERE "gymnastId" = $1 ORDER BY "createdAt" DESC', gId
  );
  console.log('Memberships:', JSON.stringify(memberships, null, 2));

  const guardians = await prisma.$queryRawUnsafe(`
    SELECT u.id, u."firstName", u."lastName", u.email
    FROM users u
    JOIN "_GuardianGymnasts" gg ON gg."A" = u.id
    WHERE gg."B" = $1
  `, gId);
  console.log('Guardians:', JSON.stringify(guardians, null, 2));

  if (guardians.length > 0) {
    const gUserId = guardians[0].id;
    const credits = await prisma.$queryRawUnsafe(
      'SELECT * FROM credits WHERE "userId" = $1 ORDER BY "expiresAt" ASC', gUserId
    );
    console.log('Credits:', JSON.stringify(credits, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
