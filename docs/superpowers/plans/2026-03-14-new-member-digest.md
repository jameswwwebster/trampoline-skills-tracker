# New Member Digest Email Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a daily digest email to coaches and admins listing any new user accounts created in the previous 24 hours, only when at least one exists.

**Architecture:** A new `sendNewMemberDigestEmail` method is added to `emailService.js`, following the existing `sendBgNumberPendingDigestEmail` pattern. A new `node-cron` block in `server.js` runs at 08:00 daily, queries for new users, and calls the email method for each coach/admin. No schema changes required.

**Tech Stack:** Node.js, Express, Prisma 5, nodemailer, node-cron.

---

## Chunk 1: Full implementation

### Task 1: Add `sendNewMemberDigestEmail` to emailService.js

**Files:**
- Modify: `backend/services/emailService.js` (add method before the final `module.exports` line)

No automated test is needed — the method follows an identical pattern to `sendBgNumberPendingDigestEmail` which is already trusted. Manual verification is in Task 2.

- [ ] **Step 1: Add the method**

Open `backend/services/emailService.js`. Find the `sendGuardianConnectionNotification` method (currently around line 415). Insert the new method immediately before it (after `sendBgNumberPendingDigestEmail` ends at line 413):

```js
  async sendNewMemberDigestEmail(coachEmail, coachFirstName, newMembers) {
    const rows = newMembers.map(m => {
      const signedUpAt = new Date(m.createdAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.firstName} ${m.lastName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.email}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#888">${signedUpAt}</td>
      </tr>`;
    }).join('');

    const text = `Hi ${coachFirstName},\n\nThe following new member${newMembers.length !== 1 ? 's have' : ' has'} signed up in the last 24 hours:\n\n` +
      newMembers.map(m => {
        const signedUpAt = new Date(m.createdAt).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        return `${m.firstName} ${m.lastName} <${m.email}> — ${signedUpAt}`;
      }).join('\n');

    return this.sendEmail({
      to: coachEmail,
      subject: `New members (last 24 hours) — ${newMembers.length} sign-up${newMembers.length !== 1 ? 's' : ''}`,
      text,
      html: brandedHtml(
        'New member sign-ups',
        `<p>Hi ${coachFirstName},</p>
        <p>The following new member${newMembers.length !== 1 ? 's have' : ' has'} signed up in the last 24 hours:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="background:#f3eefe">
              <th style="padding:6px 10px;text-align:left">Name</th>
              <th style="padding:6px 10px;text-align:left">Email</th>
              <th style="padding:6px 10px;text-align:left">Signed up</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`,
      ),
    });
  }
```

- [ ] **Step 2: Verify the file still parses**

```bash
cd backend && node -e "require('./services/emailService')" && echo "OK"
```

Expected output: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/services/emailService.js
git commit -m "feat: add sendNewMemberDigestEmail to emailService"
```

---

### Task 2: Add the daily cron to server.js

**Files:**
- Modify: `backend/server.js` (add cron block after the BG number digest block ending at line ~479)

- [ ] **Step 1: Add the cron block**

Open `backend/server.js`. Find the blank line immediately after the closing `});` of the BG number digest cron (the one with the comment `// BG number pending digest — runs daily at 07:30`, ending around line 479). Insert the following block after it:

```js
// New member digest — runs daily at 08:00
cron.schedule('0 8 * * *', async () => {
  try {
    const club = await prisma.club.findFirst();
    if (!club?.emailEnabled) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newMembers = await prisma.user.findMany({
      where: { clubId: club.id, createdAt: { gte: since } },
      select: { firstName: true, lastName: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (newMembers.length === 0) return;

    const staff = await prisma.user.findMany({
      where: { clubId: club.id, role: { in: ['CLUB_ADMIN', 'COACH'] }, isArchived: false, email: { not: null } },
      select: { email: true, firstName: true },
    });
    for (const member of staff) {
      await emailService.sendNewMemberDigestEmail(
        member.email, member.firstName, newMembers,
      ).catch(() => {});
    }
    console.log(`New member digest: sent to ${staff.length} staff (${newMembers.length} new member(s))`);
  } catch (err) {
    console.error('New member digest cron error:', err);
  }
});
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd backend && node -e "
  process.env.JWT_SECRET='test';
  process.env.NODE_ENV='test';
  // Just check it loads without syntax errors
  require('./server');
  setTimeout(() => process.exit(0), 500);
" 2>&1 | grep -v "^$" | head -20
```

Expected: Server starts and logs appear (no syntax error / crash).

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add daily new member digest cron at 08:00"
```

---

### Task 3: Push to remote

- [ ] **Step 1: Push**

```bash
git push
```

Expected: Branch pushed to origin successfully.
