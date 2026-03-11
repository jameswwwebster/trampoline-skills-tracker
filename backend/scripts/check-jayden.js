const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gId = 'cmmhqdss7000310jztdlbbcc8';

  const memberships = await prisma.$queryRawUnsafe(
    'SELECT * FROM memberships WHERE "gymnastId" = $1', gId
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
