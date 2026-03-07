const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Returns an array of Date objects for the next `weeks` occurrences
 * of `dayOfWeek` (0=Sun..6=Sat), starting from (and including) `fromDate`.
 */
function getNextNWeeksDates(dayOfWeek, fromDate, weeks) {
  const dates = [];
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);

  // Advance to first matching day
  const diff = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + diff);

  for (let i = 0; i < weeks; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

/**
 * Returns true if `date` falls within any of the closure periods.
 */
function isDateInClosure(date, closures) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return closures.some(c => {
    const start = new Date(c.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(c.endDate);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  });
}

/**
 * Generates session instances for the next 4 weeks for a given club,
 * skipping dates in closure periods and instances that already exist.
 */
async function generateRollingInstances(clubId) {
  const templates = await prisma.sessionTemplate.findMany({
    where: { clubId, isActive: true },
  });

  const closures = await prisma.closurePeriod.findMany({
    where: {
      clubId,
      endDate: { gte: new Date() },
    },
  });

  const today = new Date();
  let created = 0;

  for (const template of templates) {
    const dates = getNextNWeeksDates(template.dayOfWeek, today, 4);
    for (const date of dates) {
      if (isDateInClosure(date, closures)) continue;

      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      const existing = await prisma.sessionInstance.findUnique({
        where: { templateId_date: { templateId: template.id, date: dateOnly } },
      });

      if (!existing) {
        await prisma.sessionInstance.create({
          data: { templateId: template.id, date: dateOnly },
        });
        created++;
      }
    }
  }

  console.log(`Session generation: created ${created} instances for club ${clubId}`);
  return created;
}

module.exports = { getNextNWeeksDates, isDateInClosure, generateRollingInstances };
