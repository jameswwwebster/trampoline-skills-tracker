# Competition Entry Feature — Design Spec

**Date:** 2026-04-03

## Overview

A feature allowing coaches to set up external competition events, invite eligible gymnasts, collect entry fees through the app via Stripe, and confirm that entries have been submitted to the organiser.

---

## Data Model

### `CompetitionEvent`
Represents an external competition the club is entering.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| clubId | String | |
| name | String | e.g. "North East Regional 2026" |
| location | String | |
| startDate | DateTime | |
| endDate | DateTime | nullable — some are single day |
| entryDeadline | DateTime | editable by coach at any time |
| lateEntryFee | Int? | pence, nullable — if null, deadline is hard |
| description | String? | |
| createdAt | DateTime | |

### `CompetitionCategory`
Named entry categories for a competition (e.g. "Women's 13–14 Trampoline").

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| competitionEventId | String | |
| name | String | |
| (relation) | | Linked to existing `Competition` (skill tracker) records via a join table `CompetitionCategorySkillLevel` — gymnasts who have achieved any of these are recommended for this category |

### `CompetitionPriceTier`
Defines the price ladder for a competition. Entry number 3 means "3rd entry and beyond".

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| competitionEventId | String | |
| entryNumber | Int | 1, 2, or 3 (3 = "3 or more") |
| price | Int | pence |

### `CompetitionEntry`
One entry record per gymnast per competition.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| competitionEventId | String | |
| gymnastId | String | |
| status | Enum | `INVITED`, `PAYMENT_PENDING`, `PAID`, `DECLINED` |
| totalAmount | Int | pence, set at time of payment |
| stripePaymentIntentId | String? | |
| coachConfirmed | Boolean | default false |
| createdAt | DateTime | |

### `CompetitionEntryCategory`
Which categories a gymnast's entry includes.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| entryId | String | |
| categoryId | String | |

> **Note:** The existing `Competition` model in the schema is for skill tracking only. The new model is named `CompetitionEvent` to avoid conflict.

---

## Pricing Logic

Total for an entry = sum of tier prices for each selected category.

- 1 category selected: tier 1 price
- 2 categories: tier 1 + tier 2
- 3+ categories: tier 1 + tier 2 + (N-2 × tier 3)

If the current time is past `entryDeadline`:
- If `lateEntryFee` is set: add it to the total, allow entry
- If `lateEntryFee` is null: block new entries (hard deadline)

Deadline is editable at any time, which immediately re-evaluates late-fee eligibility.

---

## Eligible Gymnast List

When a coach opens a competition to manage invites, for each category:

1. **Recommended list**: gymnasts whose skill tracker `Competition` achievements include at least one of the category's `skillCompetitionIds`
2. Coach can manually add gymnasts not on the recommended list
3. Coach can manually remove gymnasts from the recommended list
4. A gymnast can appear across multiple categories

The final invite list (across all categories) is deduplicated — one `CompetitionEntry` per gymnast per competition, with multiple categories attached.

---

## Pages and Flows

### Admin / Coach

**`/admin/competitions`**
- List of all competitions (past and upcoming)
- Calendar view toggle
- "Create competition" button

**`/admin/competitions/new`**
- Form: name, location, start/end date, entry deadline, optional late-entry fee
- Define categories (add/remove named categories, each with linked skill tracker competition levels)
- Define price tiers (1st, 2nd, 3rd+ entry prices)

**`/admin/competitions/:id`**
Three tabs:

1. **Details** — view/edit all competition fields
2. **Invites** — per-category eligible list (recommended + manual), send invite/payment request to selected gymnasts. Shows entry status per gymnast (not invited / invited / paid / declined).
3. **Entries** — full entry status dashboard. Per gymnast: categories entered, amount paid, payment status, coach confirmation checkbox. Summary counts at top.

### Guardian / Parent

**Notification** (in-app + email) when gymnast is invited to a competition.

**Entry page** (linked from notification):
- Competition details
- Category selection (checkboxes for the categories they've been invited to)
- Running total updates as categories are selected, using price tier logic
- Late-entry fee shown prominently if applicable
- Pay via Stripe PaymentIntent
- Confirmation screen on success

**My competitions** section on guardian dashboard: upcoming entries with status.

### Shared

**Competition calendar** — visible to coaches and guardians. Shows upcoming competitions. Coaches see entry counts; guardians see their gymnast's entry status.

---

## Status Transitions

```
(not invited)
     → INVITED        (coach sends invite)
     → PAYMENT_PENDING (guardian starts checkout)
     → PAID            (Stripe payment succeeds)
     → DECLINED        (guardian declines, or coach removes)
```

PAID entries can have `coachConfirmed` set to true once the coach has submitted the entry to the organiser.

---

## Stripe Integration

- One-off `PaymentIntent` per entry (not a subscription)
- Amount locked at time of payment intent creation
- On `payment_intent.succeeded` webhook: set entry status to `PAID`
- If payment fails: status returns to `INVITED`, guardian can retry

---

## Out of Scope

- Integration with external competition registration systems
- Automatic entry submission to organisers
- Refunds (handled manually via Stripe dashboard for now)
- Team entries (individual gymnast entries only)
