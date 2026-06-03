const express = require('express');
const crypto = require('crypto');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = require('../../prisma');

const STAFF_ROLES = ['CLUB_ADMIN', 'COACH'];
const ALLOWED_HOURS = [24, 72, 168];

// The cover-coach page is rendered by THIS service (no React route), so the
// share URL has to point at the backend's own origin — not the frontend. We
// take it from the inbound request so it works in any deployment.
function publicBackendUrl(req) {
  return (process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function ageFromDob(dob, asOf) {
  if (!dob) return null;
  const d = new Date(dob), ref = new Date(asOf);
  let age = ref.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - d.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

// POST /api/booking/admin/sessions/:sessionInstanceId/register-token
router.post('/admin/sessions/:sessionInstanceId/register-token', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const hours = Number(req.body?.expiresInHours);
    if (!ALLOWED_HOURS.includes(hours)) {
      return res.status(400).json({ error: `expiresInHours must be one of ${ALLOWED_HOURS.join(', ')}` });
    }
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.sessionInstanceId },
      include: { template: { select: { clubId: true } } },
    });
    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const row = await prisma.sessionRegisterToken.create({
      data: {
        token,
        sessionInstanceId: instance.id,
        createdById: req.user.id,
        expiresAt,
      },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'session.register-token.create',
      entityType: 'SessionRegisterToken', entityId: row.id,
      metadata: { sessionInstanceId: instance.id, expiresInHours: hours },
    });

    res.status(201).json({
      id: row.id,
      url: `${publicBackendUrl(req)}/api/booking/coach-register/${token}`,
      token,
      expiresAt,
    });
  } catch (err) {
    console.error('Create register token error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/admin/sessions/:sessionInstanceId/register-tokens
router.get('/admin/sessions/:sessionInstanceId/register-tokens', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.sessionInstanceId },
      include: { template: { select: { clubId: true } } },
    });
    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date();
    const tokens = await prisma.sessionRegisterToken.findMany({
      where: { sessionInstanceId: instance.id, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });

    res.json(tokens.map(t => ({
      id: t.id,
      shortToken: t.token.slice(0, 6),
      url: `${publicBackendUrl(req)}/api/booking/coach-register/${t.token}`,
      expiresAt: t.expiresAt,
      lastViewedAt: t.lastViewedAt,
      viewCount: t.viewCount,
      createdBy: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : null,
      createdAt: t.createdAt,
    })));
  } catch (err) {
    console.error('List register tokens error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/admin/sessions/register-tokens/:id (revoke)
router.delete('/admin/sessions/register-tokens/:id', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const t = await prisma.sessionRegisterToken.findUnique({
      where: { id: req.params.id },
      include: { sessionInstance: { include: { template: { select: { clubId: true } } } } },
    });
    if (!t) return res.status(404).json({ error: 'Token not found' });
    if (t.sessionInstance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.sessionRegisterToken.update({
      where: { id: t.id },
      data: { expiresAt: new Date() },
    });
    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'session.register-token.revoke',
      entityType: 'SessionRegisterToken', entityId: t.id,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Revoke register token error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function expiredHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link expired</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:480px;margin:4rem auto;padding:1.5rem;color:#222} h1{color:#6a1b9a;margin:0 0 0.5rem}</style>
</head><body><h1>Link expired</h1><p>This session register link is no longer valid. Please ask the club for a fresh link.</p></body></html>`;
}

// GET /api/booking/coach-register/:token  (PUBLIC — no auth header)
router.get('/coach-register/:token', async (req, res) => {
  try {
    const row = await prisma.sessionRegisterToken.findUnique({
      where: { token: req.params.token },
      include: {
        sessionInstance: {
          include: {
            template: { include: { club: true } },
            bookings: {
              where: { status: 'CONFIRMED' },
              include: { lines: { include: { gymnast: true } } },
            },
            attendances: true,
          },
        },
      },
    });
    if (!row || row.expiresAt <= new Date()) {
      res.status(404).type('html').send(expiredHtml());
      return;
    }
    await prisma.sessionRegisterToken.update({
      where: { id: row.id },
      data: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
    });

    const instance = row.sessionInstance;
    const club = instance.template.club;
    const isDmt = instance.template.type === 'DMT';

    // Roster = active booking lines + active commitments minus absentees
    const absentGymnastIds = new Set(
      instance.attendances.filter(a => a.status === 'ABSENT').map(a => a.gymnastId)
    );
    const fromBookings = instance.bookings.flatMap(b =>
      b.lines.filter(l => !l.cancelledAt).map(l => l.gymnast)
    );
    const sessionDate = new Date(instance.date);
    sessionDate.setUTCHours(0, 0, 0, 0);
    const commitments = await prisma.commitment.findMany({
      where: {
        templateId: instance.templateId,
        status: 'ACTIVE',
        OR: [{ startDate: null }, { startDate: { lte: sessionDate } }],
      },
      include: { gymnast: true },
    });
    const fromCommitments = commitments.map(c => c.gymnast);
    const seen = new Set();
    const roster = [...fromBookings, ...fromCommitments].filter(g => {
      if (!g || seen.has(g.id) || absentGymnastIds.has(g.id)) return false;
      seen.add(g.id);
      return true;
    }).sort((a, b) => a.firstName.localeCompare(b.firstName));

    // Pull skills + level progress + consents per gymnast in one batch.
    const gymnastIds = roster.map(g => g.id);
    const [skillsInProgress, levelProgress, consents] = await Promise.all([
      prisma.skillProgress.findMany({
        where: { gymnastId: { in: gymnastIds }, status: 'IN_PROGRESS' },
        include: {
          skill: {
            select: {
              name: true,
              level: { select: { id: true, identifier: true, name: true, number: true } },
            },
          },
        },
      }),
      prisma.levelProgress.findMany({
        where: { gymnastId: { in: gymnastIds } },
        include: { level: { select: { id: true, identifier: true, name: true, number: true } } },
      }),
      prisma.consent.findMany({
        where: { gymnastId: { in: gymnastIds }, granted: true },
      }),
    ]);

    const byGymnast = id => ({
      skills: skillsInProgress.filter(s => s.gymnastId === id),
      levels: levelProgress.filter(l => l.gymnastId === id),
      consents: consents.filter(c => c.gymnastId === id),
    });

    const BG_LABEL = {
      VERIFIED: { label: 'Verified', color: '#2e7d32' },
      PENDING: { label: 'Pending', color: '#b78900' },
      INVALID: { label: 'Invalid', color: '#c62828' },
      EXPIRED: { label: 'Expired', color: '#c62828' },
      NOT_ON_BG: { label: 'Not on BG', color: '#c62828' },
    };

    function gymnastBlock(g) {
      const ctx = byGymnast(g.id);
      const age = ageFromDob(g.dateOfBirth, instance.date);
      // Current level = highest IN_PROGRESS, else highest COMPLETED + name "post-…"
      const inProgressLevel = ctx.levels
        .filter(l => l.status === 'IN_PROGRESS')
        .sort((a, b) => (b.level?.number ?? 0) - (a.level?.number ?? 0))[0];
      const completedLevel = ctx.levels
        .filter(l => l.status === 'COMPLETED')
        .sort((a, b) => (b.level?.number ?? 0) - (a.level?.number ?? 0))[0];
      const levelLabel = inProgressLevel
        ? `${inProgressLevel.level.identifier} — ${inProgressLevel.level.name} (in progress)`
        : completedLevel
          ? `Completed ${completedLevel.level.identifier} — ${completedLevel.level.name}`
          : 'No level on record';

      // Skills grouped by level for readability
      const skillsByLevel = new Map();
      for (const sp of ctx.skills) {
        const levelInfo = sp.skill?.level;
        const key = levelInfo ? `${String(levelInfo.number ?? 999).padStart(4, '0')}|${levelInfo.identifier} — ${levelInfo.name}` : '9999|(unlinked)';
        if (!skillsByLevel.has(key)) skillsByLevel.set(key, []);
        skillsByLevel.get(key).push(sp.skill?.name || '(unnamed skill)');
      }
      const skillsList = [...skillsByLevel.keys()]
        .sort()
        .map(k => {
          const label = k.split('|')[1] || '';
          const names = skillsByLevel.get(k).sort();
          return `<li><strong>${escapeHtml(label)}:</strong> ${names.map(escapeHtml).join(', ')}</li>`;
        })
        .join('');

      const photoCoaching = ctx.consents.some(c => c.type === 'photo_coaching');
      const photoSocial = ctx.consents.some(c => c.type === 'photo_social_media');

      const bg = BG_LABEL[g.bgNumberStatus] ?? { label: g.bgNumber ? 'No status' : 'Not on file', color: '#666' };

      return `
        <article class="gymnast">
          <header>
            <h2>${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}</h2>
            <div class="meta">
              ${age != null ? `<span class="pill">Age ${age}</span>` : ''}
              <span class="pill">${escapeHtml(levelLabel)}</span>
              <span class="pill" style="background:${bg.color}">BG: ${escapeHtml(bg.label)}</span>
              ${isDmt ? `<span class="pill" style="background:${g.dmtApproved ? '#2e7d32' : '#c62828'}">DMT ${g.dmtApproved ? 'approved' : 'not approved'}</span>` : ''}
            </div>
          </header>

          ${g.healthNotes ? `<div class="health"><strong>Health:</strong> ${escapeHtml(g.healthNotes)}</div>` : `<div class="health quiet">No health notes on file.</div>`}

          <div class="grid">
            <div>
              <h3>Skills in progress</h3>
              ${skillsList ? `<ul class="skills">${skillsList}</ul>` : `<p class="quiet">No skills currently marked in progress.</p>`}
            </div>
            <div>
              <h3>Emergency contact</h3>
              ${(g.emergencyContactName || g.emergencyContactPhone) ? `
                <p>
                  <strong>${escapeHtml(g.emergencyContactName || '—')}</strong>${g.emergencyContactRelationship ? ` <span class="quiet">(${escapeHtml(g.emergencyContactRelationship)})</span>` : ''}<br>
                  ${escapeHtml(g.emergencyContactPhone || '')}
                </p>
              ` : `<p class="quiet">Not on file.</p>`}
              <h3 style="margin-top:0.8rem">Photo consent</h3>
              <p>
                <span class="badge ${photoCoaching ? 'on' : 'off'}">Coaching photos: ${photoCoaching ? 'Yes' : 'No'}</span><br>
                <span class="badge ${photoSocial ? 'on' : 'off'}">Social media: ${photoSocial ? 'Yes' : 'No'}</span>
              </p>
            </div>
          </div>
        </article>
      `;
    }

    const dateStr = formatDate(instance.date);
    const timeStr = `${instance.template.startTime}–${instance.template.endTime}`;
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Session register — ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</title>
<style>
  :root { --brand: #6a1b9a; --border: #ddd; --muted: #666; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #222; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; font-size: 14px; }
  .page { max-width: 880px; margin: 0 auto; padding: 1.5rem 1.25rem; }
  header.intro { border-bottom: 2px solid var(--brand); padding-bottom: 0.6rem; margin-bottom: 1rem; }
  header.intro h1 { margin: 0; color: var(--brand); font-size: 1.4rem; }
  header.intro .sub { color: var(--muted); margin-top: 0.25rem; }
  .pill { display: inline-block; padding: 0.05rem 0.5rem; border-radius: 99px; font-size: 0.78rem; font-weight: 600; color: #fff; background: #555; margin-right: 0.25rem; }
  article.gymnast { border: 1px solid var(--border); border-radius: 6px; padding: 0.9rem 1rem; margin-bottom: 0.9rem; page-break-inside: avoid; }
  article.gymnast h2 { margin: 0 0 0.3rem; font-size: 1.05rem; color: var(--brand); }
  article.gymnast h3 { font-size: 0.85rem; margin: 0 0 0.3rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .meta { margin-bottom: 0.5rem; }
  .health { background: #fff7e0; border: 1px solid #f0d480; padding: 0.4rem 0.6rem; border-radius: 4px; margin-bottom: 0.5rem; }
  .health.quiet { background: #f8f8f8; border-color: var(--border); color: var(--muted); font-style: italic; }
  .grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 0.8rem; }
  ul.skills { margin: 0; padding-left: 1.1rem; }
  ul.skills li { margin: 0.15rem 0; }
  .quiet { color: var(--muted); font-style: italic; }
  .badge { display: inline-block; padding: 0.02rem 0.4rem; border-radius: 4px; font-size: 0.8rem; }
  .badge.on { background: #e8f5e9; color: #2e7d32; }
  .badge.off { background: #fde8e6; color: #c62828; }
  footer { margin-top: 1.5rem; color: var(--muted); font-size: 0.78rem; }
  @media print {
    .page { padding: 0; max-width: none; }
    body { font-size: 11.5px; }
    article.gymnast { break-inside: avoid; }
    @page { size: A4; margin: 1cm; }
  }
  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body><div class="page">
<header class="intro">
  <h1>${escapeHtml(club?.name || 'Session register')}</h1>
  <div class="sub">
    <strong>${escapeHtml(dateStr)}</strong> · ${escapeHtml(timeStr)} · ${escapeHtml(instance.template.type === 'DMT' ? 'DMT' : 'Trampoline')} · ${roster.length} on register
  </div>
</header>

${roster.length === 0 ? `<p class="quiet">No gymnasts on the register for this session.</p>` : roster.map(gymnastBlock).join('')}

<footer>
  Generated ${escapeHtml(new Date().toLocaleString('en-GB'))}. This link expires ${escapeHtml(new Date(row.expiresAt).toLocaleString('en-GB'))}. Please don't share beyond the cover coach.
</footer>
</div></body></html>`;
    res.type('html').send(html);
  } catch (err) {
    console.error('Coach register render error:', err);
    res.status(500).type('html').send(expiredHtml());
  }
});

module.exports = router;
