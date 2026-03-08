const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Write an audit log entry. Fire-and-forget — errors are swallowed so they
 * never break the main request.
 *
 * @param {object} opts
 * @param {string} opts.userId     - Staff member performing the action
 * @param {string} opts.clubId     - Club context
 * @param {string} opts.action     - Namespaced action string e.g. "booking.cancel"
 * @param {string} opts.entityType - Model name e.g. "Booking"
 * @param {string} [opts.entityId] - Affected record ID
 * @param {object} [opts.metadata] - Extra context (amounts, names, reason etc.)
 */
async function audit({ userId, clubId, action, entityType, entityId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: { userId, clubId, action, entityType, entityId: entityId || null, metadata: metadata || null },
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { audit };
