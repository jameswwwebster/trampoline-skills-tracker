const webpush = require('web-push');

// Only initialise VAPID when keys are present (skipped in test environments)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Returns the current time in Europe/London formatted as "HH:MM".
 * Handles BST/GMT automatically.
 * @param {Date} date
 * @returns {string} e.g. "17:00"
 */
function getUKHHMM(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Returns { gte, lt } for today's date in Europe/London — handles the midnight
 * edge case during BST where UTC date !== UK calendar date.
 * @param {Date} now
 * @returns {{ gte: Date, lt: Date }}
 */
function getUKDateBounds(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const day = parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value;
  const year = parts.find(p => p.type === 'year').value;

  const gte = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

/**
 * Send a push notification to all coaches in the given club who have the
 * specified notification type enabled (or have no preference row — absence
 * defaults to enabled). Stale subscriptions (410/404) are silently removed.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} clubId
 * @param {'SESSION_REMINDER'} notificationType
 * @param {{ title: string, body: string, url?: string }} payload
 */
async function sendToCoaches(prisma, clubId, notificationType, payload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        clubId,
        role: 'COACH',
      },
    },
    include: {
      user: {
        include: {
          pushNotificationPreferences: {
            where: { notificationType },
          },
        },
      },
    },
  });

  const payloadStr = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      const pref = sub.user.pushNotificationPreferences[0];
      if (pref && !pref.enabled) return;

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`Push send failed for subscription ${sub.id}:`, err.message);
        }
      }
    })
  );
}

module.exports = { sendToCoaches, getUKHHMM, getUKDateBounds };
