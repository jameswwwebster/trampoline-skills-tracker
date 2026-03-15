# Credits & Charges Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface charges alongside credits in the member detail card, consolidate the club-wide admin view into a single "Credits & Charges" page, add an outstanding charges card to the parent's My Account page, and send notification emails on charge/credit create and delete.

**Architecture:** Backend first (email functions, then route changes with tests), then frontend (bookingApi method, AdminMembers charges panel, AdminCharges credits section, nav rename, MyChildren charges card). No schema changes.

**Tech Stack:** Express, Prisma 5, PostgreSQL, React 18, nodemailer (emailService singleton)

---

## Chunk 1: Backend

### Task 1: Add four email functions to emailService.js

**Files:**
- Modify: `backend/services/emailService.js`

- [ ] **Step 1: Read the file to find where to add the new methods**

Read `backend/services/emailService.js`. Find the last `async send...` method before `module.exports`. Add the four new methods before `module.exports = new EmailService();`.

The file uses a `_send` helper, a `brandedHtml` template function, an `infoBox` helper, and a `muted` helper. Use the same pattern as `sendMembershipPaymentSuccessEmail`.

- [ ] **Step 2: Add the four methods**

Add these four methods:

```js
  async sendChargeCreatedEmail(email, firstName, description, amountPence, dueDate) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const due = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A charge has been added to your account',
      html: brandedHtml('Charge added', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A charge of <strong style="color:#e74c3c">${amount}</strong> has been added to your account.</p>
        ${infoBox(`
          <p style="margin:0.2rem 0"><strong>Description:</strong> ${description}</p>
          <p style="margin:0.2rem 0"><strong>Due by:</strong> ${due}</p>
        `)}
        <p>You can pay this via the cart when you next book.</p>
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge of ${amount} has been added to your account.\n\nDescription: ${description}\nDue by: ${due}\n\nYou can pay this via the cart when you next book.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount, description });
  }

  async sendChargeDeletedEmail(email, firstName, description, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A charge on your account has been cancelled',
      html: brandedHtml('Charge cancelled', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A charge of <strong>${amount}</strong> (${description}) has been cancelled.</p>
        <p>No payment is required.</p>
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge of ${amount} (${description}) has been cancelled. No payment is required.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount, description });
  }

  async sendCreditAssignedEmail(email, firstName, amountPence, expiresAt) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const expiry = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A credit has been added to your account',
      html: brandedHtml('Credit added', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A credit of <strong style="color:#7c35e8">${amount}</strong> has been added to your account.</p>
        ${infoBox(`<p style="margin:0">Expires: <strong>${expiry}</strong></p>`)}
        <p>Credits are applied automatically at checkout.</p>
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA credit of ${amount} has been added to your account. It expires on ${expiry}.\n\nCredits are applied automatically at checkout.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount });
  }

  async sendCreditDeletedEmail(email, firstName, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A credit has been removed from your account',
      html: brandedHtml('Credit removed', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A credit of <strong>${amount}</strong> has been removed from your account.</p>
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA credit of ${amount} has been removed from your account.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount });
  }
```

- [ ] **Step 3: Verify the module loads**

```bash
cd backend && node -e "const e = require('./services/emailService'); console.log(typeof e.sendChargeCreatedEmail, typeof e.sendChargeDeletedEmail, typeof e.sendCreditAssignedEmail, typeof e.sendCreditDeletedEmail)"
```

Expected: `function function function function`

- [ ] **Step 4: Commit**

```bash
git add backend/services/emailService.js
git commit -m "feat: add charge and credit notification email functions"
```

---

### Task 2: Update charges.js — userId filter and email calls

**Files:**
- Modify: `backend/routes/booking/charges.js`
- Modify: `backend/__tests__/booking.charges.test.js`

- [ ] **Step 1: Add emailService import to the test file**

At the top of `backend/__tests__/booking.charges.test.js`, add after the existing requires:

```js
const emailService = require('../services/emailService');
```

- [ ] **Step 2: Write failing tests for userId filter and email behaviour**

In `backend/__tests__/booking.charges.test.js`, find the `describe('GET /api/booking/charges'` block. Add two tests inside it before its closing `});`:

```js
  it('filters by userId when query param provided', async () => {
    const res = await request(app)
      .get(`/api/booking/charges?userId=${parent.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(c => c.userId === parent.id)).toBe(true);
  });

  it('returns empty array for userId with no charges', async () => {
    const res = await request(app)
      .get(`/api/booking/charges?userId=${parent2.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
```

Find the `describe('POST /api/booking/charges'` block. Add two tests inside it before its closing `});`:

```js
  it('sends charge created email when emailEnabled is true', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const spy = jest.spyOn(emailService, 'sendChargeCreatedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/charges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 1500, description: 'Test charge', dueDate: new Date(Date.now() + 7 * 86400000).toISOString() });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
      await prisma.charge.deleteMany({ where: { clubId: club.id } });
    }
  });

  it('does not send email when emailEnabled is false', async () => {
    const spy = jest.spyOn(emailService, 'sendChargeCreatedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/charges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 1500, description: 'Test charge', dueDate: new Date(Date.now() + 7 * 86400000).toISOString() });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      await prisma.charge.deleteMany({ where: { clubId: club.id } });
    }
  });
```

Find the `describe('DELETE /api/booking/charges/:id'` block. Add one test inside it before its closing `});`:

```js
  it('sends charge deleted email when emailEnabled is true', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const charge = await seedCharge();
    const spy = jest.spyOn(emailService, 'sendChargeDeletedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .delete(`/api/booking/charges/${charge.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    }
  });
```

- [ ] **Step 4: Add userId filter to GET / in charges.js**

In `backend/routes/booking/charges.js`, replace the `GET /` handler's `findMany` call:

```js
// Before:
    const charges = await prisma.charge.findMany({
      where: { clubId: req.user.clubId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

// After:
    const { userId } = req.query;
    const charges = await prisma.charge.findMany({
      where: { clubId: req.user.clubId, ...(userId ? { userId } : {}) },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
```

- [ ] **Step 5: Add emailService import to charges.js**

At the top of `backend/routes/booking/charges.js`, add after the existing requires:

```js
const emailService = require('../../services/emailService');
```

- [ ] **Step 6: Add email call to POST /**

In the `POST /` handler, change the `prisma.user.findFirst` call to also fetch the club:

```js
// Before:
    const targetUser = await prisma.user.findFirst({
      where: { id: value.userId, clubId: req.user.clubId },
    });

// After:
    const targetUser = await prisma.user.findFirst({
      where: { id: value.userId, clubId: req.user.clubId },
      include: { club: { select: { emailEnabled: true } } },
    });
```

Then after the `await audit(...)` call and before `res.status(201).json(charge)`, add:

```js
    if (targetUser.club.emailEnabled) {
      await emailService.sendChargeCreatedEmail(
        targetUser.email,
        targetUser.firstName,
        value.description,
        value.amount,
        value.dueDate,
      );
    }
```

- [ ] **Step 7: Add email call to DELETE /:id**

In the `DELETE /:id` handler, change the `prisma.charge.findFirst` call to also fetch user email and club:

```js
// Before:
    const charge = await prisma.charge.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });

// After:
    const charge = await prisma.charge.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: {
        user: {
          select: { clubId: true, email: true, firstName: true, club: { select: { emailEnabled: true } } },
        },
      },
    });
```

Note: the existing `if (charge.paidAt)` guard uses `charge.paidAt` directly — this still works because `findFirst` returns all scalar fields plus the included `user`.

Then after `await audit(...)` and before `res.json({ success: true })`, add:

```js
    if (charge.user.club.emailEnabled) {
      await emailService.sendChargeDeletedEmail(
        charge.user.email,
        charge.user.firstName,
        charge.description,
        charge.amount,
      );
    }
```

- [ ] **Step 8: Run the charges tests**

```bash
cd backend && npm test -- --testPathPattern="booking.charges" --forceExit 2>&1 | tail -15
```

Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add backend/routes/booking/charges.js backend/__tests__/booking.charges.test.js
git commit -m "feat: add userId filter to GET /charges and charge notification emails"
```

---

### Task 3: Update credits.js — email calls

**Files:**
- Modify: `backend/routes/booking/credits.js`
- Modify: `backend/__tests__/booking.charges.test.js` (re-use test file for credits email spy tests — credits have no dedicated test file for assign/delete)

- [ ] **Step 1: Write failing tests for credit email behaviour**

At the bottom of `backend/__tests__/booking.charges.test.js` (after the last `});`), add:

```js
describe('POST /api/booking/credits/assign — email', () => {
  afterEach(() => prisma.credit.deleteMany({}));

  it('sends credit assigned email when emailEnabled is true', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const spy = jest.spyOn(emailService, 'sendCreditAssignedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/credits/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 500, expiresInDays: 30 });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    }
  });

  it('does not send email when emailEnabled is false', async () => {
    const spy = jest.spyOn(emailService, 'sendCreditAssignedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/credits/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 500, expiresInDays: 30 });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('DELETE /api/booking/credits/:id — email', () => {
  it('sends credit deleted email when emailEnabled is true', async () => {
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const credit = await prisma.credit.create({
      data: { userId: parent.id, amount: 500, expiresAt },
    });
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const spy = jest.spyOn(emailService, 'sendCreditDeletedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .delete(`/api/booking/credits/${credit.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    }
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd backend && npm test -- --testPathPattern="booking.charges" --forceExit 2>&1 | tail -15
```

Expected: The three new credit email tests FAIL.

- [ ] **Step 3: Add emailService import**

At the top of `backend/routes/booking/credits.js`, add after the existing requires:

```js
const emailService = require('../../services/emailService');
```

- [ ] **Step 4: Add email call to POST /assign**

In the `POST /assign` handler, the `targetUser` fetch is:
```js
const targetUser = await prisma.user.findFirst({
  where: { id: value.userId, clubId: req.user.clubId },
});
```

Change it to include the club:
```js
const targetUser = await prisma.user.findFirst({
  where: { id: value.userId, clubId: req.user.clubId },
  include: { club: { select: { emailEnabled: true } } },
});
```

Then after `await audit(...)` and before `res.status(201).json(credit)`, add:

```js
    if (targetUser.club.emailEnabled) {
      await emailService.sendCreditAssignedEmail(
        targetUser.email,
        targetUser.firstName,
        value.amount,
        credit.expiresAt,
      );
    }
```

- [ ] **Step 5: Add email call to DELETE /:id**

In the `DELETE /:id` handler, the credit fetch is:
```js
const credit = await prisma.credit.findUnique({
  where: { id: req.params.id },
  include: { user: { select: { clubId: true } } },
});
```

Change it to:
```js
const credit = await prisma.credit.findUnique({
  where: { id: req.params.id },
  include: {
    user: {
      select: { clubId: true, email: true, firstName: true, club: { select: { emailEnabled: true } } },
    },
  },
});
```

Then after `await audit(...)` and before `res.json({ success: true })`, add:

```js
    if (credit.user.club.emailEnabled) {
      await emailService.sendCreditDeletedEmail(
        credit.user.email,
        credit.user.firstName,
        credit.amount,
      );
    }
```

- [ ] **Step 6: Run the full backend test suite**

```bash
cd backend && npm test -- --forceExit 2>&1 | tail -10
```

Expected: All suites pass.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/booking/credits.js backend/__tests__/booking.charges.test.js
git commit -m "feat: add credit notification emails on assign and delete"
```

---

## Chunk 2: Frontend

### Task 4: Add getChargesForUser to bookingApi.js

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

- [ ] **Step 1: Add the method**

In `frontend/src/utils/bookingApi.js`, in the `bookingApi` object, add after `getAdminCharges`:

```js
  getChargesForUser: (userId) =>
    axios.get(`${API_URL}/booking/charges?userId=${encodeURIComponent(userId)}`, { headers: getHeaders() }),
```

- [ ] **Step 2: Verify the file parses**

```bash
cd frontend && node -e "require('./src/utils/bookingApi')" 2>&1 || echo "Parse OK (ES module warning is fine)"
```

The import check here is just ensuring no syntax errors. If you get a module error (ES modules), that's fine — the file uses ES module syntax.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/bookingApi.js
git commit -m "feat: add getChargesForUser to bookingApi"
```

---

### Task 5: AdminMembers.js — charges collapsible row

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

Read the full `MemberDetail` function (starts at line 1002) before editing.

- [ ] **Step 1: Add state variables and helpers**

In `MemberDetail`, after `const [creditsOpen, setCreditsOpen] = useState(false);` (line 1018), add:

```js
  const [chargesOpen, setChargesOpen] = useState(false);
  const [memberCharges, setMemberCharges] = useState(null); // null = not yet fetched
  const [chargesLoading, setChargesLoading] = useState(false);
  const [addingCharge, setAddingCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return { description: '', amount: '', dueDate: d.toISOString().split('T')[0] };
  });
  const [chargeFormError, setChargeFormError] = useState(null);
  const [submittingCharge, setSubmittingCharge] = useState(false);
```

- [ ] **Step 2: Add charge handlers**

After `const load = () => {` function definition (around line 1076), add:

```js
  const loadCharges = async () => {
    setChargesLoading(true);
    try {
      const res = await bookingApi.getChargesForUser(userId);
      setMemberCharges(res.data.filter(c => !c.paidAt)); // outstanding only
    } catch {
      setMemberCharges([]);
    } finally {
      setChargesLoading(false);
    }
  };

  const handleToggleCharges = () => {
    const opening = !chargesOpen;
    setChargesOpen(opening);
    if (opening && memberCharges === null) loadCharges();
  };

  const handleCreateCharge = async (e) => {
    e.preventDefault();
    setChargeFormError(null);
    setSubmittingCharge(true);
    try {
      const amountPence = Math.round(parseFloat(chargeForm.amount) * 100);
      if (isNaN(amountPence) || amountPence < 1) {
        setChargeFormError('Amount must be a positive number');
        return;
      }
      await bookingApi.createCharge({
        userId,
        amount: amountPence,
        description: chargeForm.description,
        dueDate: new Date(chargeForm.dueDate).toISOString(),
      });
      const d = new Date(); d.setDate(d.getDate() + 7);
      setAddingCharge(false);
      setChargeForm({ description: '', amount: '', dueDate: d.toISOString().split('T')[0] });
      await loadCharges();
    } catch (err) {
      setChargeFormError(err.response?.data?.error || 'Failed to create charge');
    } finally {
      setSubmittingCharge(false);
    }
  };

  const handleDeleteCharge = async (chargeId) => {
    if (!window.confirm('Delete this charge?')) return;
    try {
      await bookingApi.deleteCharge(chargeId);
      await loadCharges();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete charge');
    }
  };
```

- [ ] **Step 3: Add computed value**

After `const totalCredits = member.credits.reduce((s, c) => s + c.amount, 0);` (line 1092), add:

```js
  const outstandingChargesTotal = memberCharges ? memberCharges.reduce((s, c) => s + c.amount, 0) : 0;
  // Note: memberCharges is filtered to unpaid only in loadCharges, so no further filter needed here.
```

- [ ] **Step 4: Add Charges row to the info list**

In the info list array (the `[{ key: 'Email'... }, ...]` array), add a Charges entry after the Credits entry:

```js
                {
                  key: 'Charges',
                  val: (
                    <button
                      onClick={handleToggleCharges}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem',
                        color: outstandingChargesTotal > 0 ? 'var(--booking-danger)' : 'var(--booking-text-muted)',
                        fontWeight: outstandingChargesTotal > 0 ? 600 : 'normal',
                      }}
                    >
                      {memberCharges === null
                        ? 'View charges'
                        : outstandingChargesTotal > 0
                          ? `£${(outstandingChargesTotal / 100).toFixed(2)} outstanding`
                          : 'No outstanding charges'
                      } {chargesOpen ? '▴' : '▾'}
                    </button>
                  ),
                },
```

- [ ] **Step 5: Add charges expanded panel**

After the credits expanded panel (after the closing `}` of `{creditsOpen && totalCredits > 0 && (...)}`, around line 1181), add:

```jsx
            {chargesOpen && (
              <div style={{
                marginTop: '0.5rem',
                background: 'rgba(231,76,60,0.03)',
                border: '1px solid rgba(231,76,60,0.15)',
                borderRadius: 'var(--booking-radius)',
                padding: '0.65rem 0.75rem',
              }}>
                {chargesLoading && <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading...</p>}
                {!chargesLoading && memberCharges !== null && (
                  <>
                    {memberCharges.length === 0 && !addingCharge && (
                      <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>No outstanding charges.</p>
                    )}
                    {memberCharges.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.875rem', padding: '0.2rem 0', borderBottom: '1px solid var(--booking-bg-light)',
                      }}>
                        <div>
                          <span>{c.description}</span>
                          <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                            £{(c.amount / 100).toFixed(2)} · Due {new Date(c.dueDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <button
                          className="bk-btn bk-btn--sm"
                          style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                          onClick={() => handleDeleteCharge(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {addingCharge ? (
                      <form onSubmit={handleCreateCharge} style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input className="bk-input" placeholder="Description" required value={chargeForm.description}
                          onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                        <input type="number" step="0.01" min="0.01" className="bk-input" placeholder="Amount (£)" required value={chargeForm.amount}
                          onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                        <input type="date" className="bk-input" required value={chargeForm.dueDate}
                          onChange={e => setChargeForm(f => ({ ...f, dueDate: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                        {chargeFormError && <p style={{ color: 'var(--booking-danger)', fontSize: '0.82rem', margin: 0 }}>{chargeFormError}</p>}
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="submit" className="bk-btn bk-btn--sm bk-btn--primary" disabled={submittingCharge}>
                            {submittingCharge ? 'Adding...' : 'Add charge'}
                          </button>
                          <button type="button" className="bk-btn bk-btn--sm" onClick={() => { setAddingCharge(false); setChargeFormError(null); }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button className="bk-btn bk-btn--sm bk-btn--primary" style={{ marginTop: '0.5rem' }}
                        onClick={() => setAddingCharge(true)}>
                        + Add charge
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
```

- [ ] **Step 6: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: add charges collapsible panel to member detail card"
```

---

### Task 6: AdminCharges.js — add credits section, remove create form

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminCharges.js`

Read the full file before editing (it is short — 170 lines).

- [ ] **Step 1: Add credits state and fetch**

In `AdminCharges.js`, add to the existing state declarations:

```js
  const [credits, setCredits] = useState([]);
```

In the existing `useEffect`, extend the `Promise.all` to also fetch credits:

```js
// Before:
    Promise.all([
      bookingApi.getAdminCharges(),
      bookingApi.getMembers(),
    ])
      .then(([chargesRes, membersRes]) => {
        setCharges(chargesRes.data);
        setMembers(membersRes.data.filter(m => m.role === 'PARENT'));
      })

// After:
    Promise.all([
      bookingApi.getAdminCharges(),
      bookingApi.getMembers(),
      bookingApi.getAllCredits(),
    ])
      .then(([chargesRes, membersRes, creditsRes]) => {
        setCharges(chargesRes.data);
        setMembers(membersRes.data.filter(m => m.role === 'PARENT'));
        setCredits(creditsRes.data.filter(u => u.totalCredits > 0));
      })
```

Also remove `members` state and the `getMembers` fetch since the create form is being removed... actually keep `members` in state as it is, because the `getMembers` call is still there until we remove the form. Wait — we're removing the create form entirely, so `members` is no longer needed. Remove the `const [members, setMembers] = useState([]);` line, remove `bookingApi.getMembers()` from the Promise.all, and remove the `setMembers` call.

So the full updated state and useEffect:

```js
  const [charges, setCharges] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bookingApi.getAdminCharges(),
      bookingApi.getAllCredits(),
    ])
      .then(([chargesRes, creditsRes]) => {
        setCharges(chargesRes.data);
        setCredits(creditsRes.data.filter(u => u.totalCredits > 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
```

Remove these state variables that were only used by the create form:
- `const [form, setForm] = useState(...)`
- `const [formError, setFormError] = useState(null)`
- `const [submitting, setSubmitting] = useState(false)`

Remove the `handleCreate` function entirely.

- [ ] **Step 2: Replace the JSX**

Replace the entire `return (...)` with:

```jsx
  return (
    <div className="bk-page">
      <h2>Credits &amp; Charges</h2>

      <section style={{ marginBottom: '2.5rem' }}>
        <h3>Credits</h3>
        {credits.length === 0 ? (
          <p style={{ color: 'var(--booking-text-muted)' }}>No active credits.</p>
        ) : (
          <table className="bk-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Total credits</th>
              </tr>
            </thead>
            <tbody>
              {credits.map(u => (
                <tr key={u.id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.email}</td>
                  <td style={{ textAlign: 'right', color: 'var(--booking-accent)', fontWeight: 600 }}>
                    £{(u.totalCredits / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Charges</h3>
        {charges.length === 0 ? (
          <p style={{ color: 'var(--booking-text-muted)' }}>No charges yet.</p>
        ) : (
          <table className="bk-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Due date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {charges.map(c => (
                <tr key={c.id}>
                  <td>{c.user.firstName} {c.user.lastName}</td>
                  <td>{c.description}</td>
                  <td>£{(c.amount / 100).toFixed(2)}</td>
                  <td>{new Date(c.dueDate).toLocaleDateString('en-GB')}</td>
                  <td>{c.paidAt ? <span style={{ color: 'var(--booking-success)' }}>Paid</span> : 'Unpaid'}</td>
                  <td>
                    <button
                      className="bk-btn bk-btn--danger bk-btn--sm"
                      onClick={() => handleDelete(c.id)}
                      disabled={!!c.paidAt}
                      title={c.paidAt ? 'Cannot delete paid charge' : 'Delete'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
```

Note: keep the existing `handleDelete` function — it is still needed for the charges table.

Also retain the existing loading guard before the `return`. Place it immediately before the `return (`:

```js
  if (loading) return <div className="bk-page"><p>Loading…</p></div>;
```

- [ ] **Step 3: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminCharges.js
git commit -m "feat: add credits section to AdminCharges, remove create form"
```

---

### Task 7: BookingLayout.js nav rename and MyChildren.js charges card

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`
- Modify: `frontend/src/pages/booking/MyChildren.js`

Read both files before editing.

- [ ] **Step 1: Rename the nav link in BookingLayout.js**

In `frontend/src/pages/booking/BookingLayout.js`, find the NavLink with text "Admin Charges" and change it to "Credits &amp; Charges":

```jsx
// Before:
<NavLink to="/booking/admin/charges" ...>Charges</NavLink>

// After:
<NavLink to="/booking/admin/charges" ...>Credits &amp; Charges</NavLink>
```

The route path stays the same — only the label changes.

- [ ] **Step 2: Add charges state and fetch to MyChildren.js**

In `frontend/src/pages/booking/MyChildren.js`, the existing `useEffect` fetches credits and memberships. Add charges:

```js
// Add state variable alongside the existing ones:
  const [charges, setCharges] = useState([]);
```

```js
// In useEffect, add:
    bookingApi.getMyCharges().then(r => setCharges(r.data)).catch(() => {});
```

- [ ] **Step 3: Add the charges card to MyChildren.js**

In `MyChildren.js`, directly after the credits card block (after the closing `}` of `{credits.length > 0 && (...)}`, around line 685), add:

```jsx
      {charges.length > 0 && (
        <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Outstanding charges</p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>
            Settled automatically at checkout — go to your cart to pay.
          </p>
          <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--booking-danger)' }}>
            £{(charges.reduce((s, c) => s + c.amount, 0) / 100).toFixed(2)} outstanding
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {charges.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{c.description}</span>
                <span className="bk-muted">Due {new Date(c.dueDate).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 5: Run the full backend test suite**

```bash
cd backend && npm test -- --forceExit 2>&1 | tail -10
```

Expected: All suites pass.

- [ ] **Step 6: Commit and push**

```bash
git add frontend/src/pages/booking/BookingLayout.js frontend/src/pages/booking/MyChildren.js
git commit -m "feat: rename Credits & Charges nav link and add charges card to My Account"
git push
```
