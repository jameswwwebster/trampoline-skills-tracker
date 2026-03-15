# Admin Member Card — Credits & Charges Row Layout — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the credits and charges rows in the admin member card so each row header shows the summary total and an add button, with the expanded section showing the list.

**Architecture:** Pure frontend change to MemberDetail in AdminMembers.js. Credits and Charges list items are extracted from the shared map() and rendered as standalone <li> elements with three-part flex layout. AssignCreditForm moves from a standalone div into the credits expanded section.

**Tech Stack:** React 18

---

## Task 1: Restructure credits row

Extract the Credits entry from the `.map()` array, render it as a standalone `<li>` with a three-part flex header, move `AssignCreditForm` into the credits expanded section, and remove the standalone assign credit div.

### 1a — Remove the Credits entry from the map array

- [ ] In `/Users/james/Documents/Projects/Experiments/life/frontend/src/pages/booking/admin/AdminMembers.js`, find the `.map()` array starting around line 1187. Remove the entire Credits object (lines 1212–1223):

```js
{
  key: 'Credits', val: totalCredits > 0
    ? (
      <button
        onClick={() => setCreditsOpen(v => !v)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--booking-accent)', fontWeight: 600, fontSize: '0.875rem' }}
      >
        £{(totalCredits / 100).toFixed(2)} {creditsOpen ? '▴' : '▾'}
      </button>
    )
    : <span className="bk-muted">No credits</span>
},
```

### 1b — Add a standalone Credits `<li>` after the closing `</ul>` tag (after line 1254)

- [ ] Insert the following immediately after `</ul>` (around line 1255, before the `{member.isArchived && ...}` block):

```jsx
{/* Credits row — standalone li with flex header */}
<ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
  <li
    style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)',
      gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer',
    }}
    onClick={() => setCreditsOpen(v => !v)}
  >
    <span style={{ color: 'var(--booking-text-muted)', flexShrink: 0 }}>Credits</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
      {totalCredits > 0
        ? <span style={{ color: 'var(--booking-accent)', fontWeight: 600 }}>£{(totalCredits / 100).toFixed(2)}</span>
        : <span className="bk-muted">No credits</span>
      }
    </span>
    <button
      className="bk-btn bk-btn--sm bk-btn--primary"
      style={{ flexShrink: 0 }}
      onClick={e => { e.stopPropagation(); setCreditsOpen(true); setAssigningCredit(true); }}
    >
      + Assign credit
    </button>
    <span style={{ flexShrink: 0, color: 'var(--booking-text-muted)', fontSize: '0.75rem' }}>
      {creditsOpen ? '▴' : '▾'}
    </span>
  </li>
</ul>
```

### 1c — Replace the credits expanded section (guard change + move AssignCreditForm)

- [ ] Replace the existing credits expanded section (around lines 1267–1285):

Old code:
```jsx
{/* Credits inline expand — only when there are credits to show */}
{creditsOpen && totalCredits > 0 && (
  <div style={{
    marginTop: '0.5rem', background: 'rgba(124,53,232,0.05)',
    border: '1px solid rgba(124,53,232,0.15)', borderRadius: 'var(--booking-radius)',
    padding: '0.65rem 0.75rem',
  }}>
    {member.credits.map(c => (
      <div key={c.id} style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: '0.875rem', padding: '0.2rem 0',
        borderBottom: '1px solid var(--booking-bg-light)',
      }}>
        <span>£{(c.amount / 100).toFixed(2)}</span>
        <span className="bk-muted">Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
      </div>
    ))}
  </div>
)}
```

New code (remove `totalCredits > 0` guard; add "No credits" fallback; add AssignCreditForm):
```jsx
{/* Credits inline expand */}
{creditsOpen && (
  <div style={{
    marginTop: '0.5rem', background: 'rgba(124,53,232,0.05)',
    border: '1px solid rgba(124,53,232,0.15)', borderRadius: 'var(--booking-radius)',
    padding: '0.65rem 0.75rem',
  }}>
    {totalCredits === 0 && !assigningCredit && (
      <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>No credits.</p>
    )}
    {member.credits.map(c => (
      <div key={c.id} style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: '0.875rem', padding: '0.2rem 0',
        borderBottom: '1px solid var(--booking-bg-light)',
      }}>
        <span>£{(c.amount / 100).toFixed(2)}</span>
        <span className="bk-muted">Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
      </div>
    ))}
    {assigningCredit && (
      <AssignCreditForm userId={member.id} onDone={() => { setAssigningCredit(false); load(); }} />
    )}
  </div>
)}
```

### 1d — Remove the standalone assign credit div

- [ ] Delete the following block (around lines 1350–1359):

```jsx
{/* Assign credit — always accessible regardless of current balance */}
<div style={{ marginTop: '0.5rem' }}>
  {assigningCredit ? (
    <AssignCreditForm userId={member.id} onDone={() => { setAssigningCredit(false); load(); }} />
  ) : (
    <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setAssigningCredit(true)}>
      + Assign credit
    </button>
  )}
</div>
```

### Manual verification — Task 1

- [ ] Open the app in the browser and navigate to any member's detail card in admin.
- [ ] Confirm the Credits row shows three parts: label on the left, credit total (or "No credits" text) in the middle, `+ Assign credit` button, and a `▾` toggle arrow on the right.
- [ ] Click the row label or arrow — confirm the credits expanded section opens/closes.
- [ ] When closed, click `+ Assign credit` — confirm the expanded section opens and the `AssignCreditForm` is shown without toggling closed again.
- [ ] For a member with no credits: confirm the expanded section shows "No credits." text when open and `assigningCredit` is false.
- [ ] For a member with credits: confirm the credit rows appear inside the expanded section.
- [ ] Confirm the old standalone `+ Assign credit` button below the two expandable rows is gone.

### Commit — Task 1

- [ ] `git add frontend/src/pages/booking/admin/AdminMembers.js`
- [ ] `git commit -m "feat: move assign credit button into credits row header and expand section"`

---

## Task 2: Restructure charges row

Extract the Charges entry from the `.map()` array and render it as a standalone `<li>` with a three-part flex header. The charges expanded section itself is unchanged.

### 2a — Remove the Charges entry from the map array

- [ ] In the `.map()` array, remove the entire Charges object (around lines 1224–1243):

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
// Note: + Assign credit button is rendered below the list always (see below)
```

### 2b — Add a standalone Charges `<li>` after the Credits `<ul>` block added in Task 1

- [ ] Immediately after the Credits `</ul>` block inserted in Task 1, add:

```jsx
{/* Charges row — standalone li with flex header */}
<ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
  <li
    style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)',
      gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer',
    }}
    onClick={handleToggleCharges}
  >
    <span style={{ color: 'var(--booking-text-muted)', flexShrink: 0 }}>Charges</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto',
      color: outstandingChargesTotal > 0 ? 'var(--booking-danger)' : 'var(--booking-text-muted)',
      fontWeight: outstandingChargesTotal > 0 ? 600 : 'normal',
    }}>
      {memberCharges === null
        ? 'View charges'
        : outstandingChargesTotal > 0
          ? `£${(outstandingChargesTotal / 100).toFixed(2)} outstanding`
          : 'No outstanding charges'
      }
    </span>
    <button
      className="bk-btn bk-btn--sm bk-btn--primary"
      style={{ flexShrink: 0 }}
      onClick={e => {
        e.stopPropagation();
        setChargesOpen(true);
        setAddingCharge(true);
        if (memberCharges === null) loadCharges();
      }}
    >
      + Add charge
    </button>
    <span style={{ flexShrink: 0, color: 'var(--booking-text-muted)', fontSize: '0.75rem' }}>
      {chargesOpen ? '▴' : '▾'}
    </span>
  </li>
</ul>
```

### Manual verification — Task 2

- [ ] Navigate to any member detail card in admin.
- [ ] Confirm the Charges row shows three parts: label on the left, charges summary in the middle, `+ Add charge` button, and a `▾` toggle arrow on the right.
- [ ] Click the row label or arrow — confirm the charges expanded section opens/closes.
- [ ] When the charges section opens via the row click, confirm it loads charges (spinner then list or "No outstanding charges").
- [ ] When closed, click `+ Add charge` — confirm the charges expanded section opens with the add charge form already visible (i.e. `addingCharge` is true), and charges load if not yet fetched.
- [ ] Confirm clicking `+ Add charge` does not toggle the row closed.
- [ ] Confirm the charges expanded section content (list, form, delete buttons) is unchanged.

### Commit — Task 2

- [ ] `git add frontend/src/pages/booking/admin/AdminMembers.js`
- [ ] `git commit -m "feat: move add charge button into charges row header"`
