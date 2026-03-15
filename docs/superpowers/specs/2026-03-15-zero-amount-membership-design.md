# Zero-Amount Membership — Design Spec

**Date:** 2026-03-15

## Goal

Allow a membership to be created with `monthlyAmount = 0` so a gymnast can attend for free. A £0 membership skips Stripe entirely and activates immediately.

## Files Changed

- **`backend/routes/booking/memberships.js`** — change `Joi.number().integer().min(1)` to `min(0)` in the `POST /` body schema; add a guard in `PATCH /:id` to block editing to £0 when a Stripe subscription exists
- **`backend/services/membershipActivationService.js`** — skip the Stripe block when `membership.monthlyAmount === 0`; the existing default values (`newStatus = 'ACTIVE'`, `stripeSubscriptionId = null`, `needsPaymentMethod = false`) are already correct for a £0 membership
- **`frontend/src/pages/booking/admin/AdminMembers.js`** — change `min="0.01"` to `min="0"` on **both** monthly amount inputs in `GymnastMembership`: the add-membership form (line ~841) and the edit-amount form (line ~817)

## Detailed Behaviour

### Creation (`POST /booking/memberships`)

The Joi schema currently validates `monthlyAmount: Joi.number().integer().min(1).required()`. Change to `min(0)`.

The `POST /` handler calls `activateMembership` when the start date is today or in the past. For £0 memberships, `activateMembership` skips Stripe and sets status directly to `ACTIVE` with no subscription ID.

For a scheduled £0 membership (future start date), no Stripe interaction occurs at creation time. When the cron job activates the membership on its start date, `activateMembership` is called and applies the same £0 skip.

### Activation (`membershipActivationService.js`)

Replace the existing outer `if (process.env.STRIPE_SECRET_KEY)` block with:

```js
if (membership.monthlyAmount === 0) {
  // No Stripe subscription for free memberships — defaults already set correctly
} else if (process.env.STRIPE_SECRET_KEY) {
  // ... existing Stripe logic unchanged ...
}
```

`newStatus`, `stripeSubscriptionId`, and `needsPaymentMethod` are initialised before the block as `'ACTIVE'`, `null`, `false` — which are exactly right for a £0 membership. No other changes needed.

### Edit amount (`PATCH /:id`)

The `PATCH /:id` amount validator stays as-is (`min(1)`) — there is no need to allow editing to £0. The simple constraint avoids the complexity of cancelling or creating Stripe subscriptions mid-life:

- Editing a non-zero membership to £0 would require cancelling the Stripe subscription — out of scope.
- Editing a £0 membership to a non-zero amount would require creating a new Stripe subscription — out of scope.

If an admin wants to switch a gymnast from free to paid (or vice versa), they cancel the existing membership and create a new one.

### Frontend form

`GymnastMembership` has two `min="0.01"` inputs — both must be updated to `min="0"`:

1. The **add-membership** creation form (`showForm`):
   ```jsx
   <input type="number" step="0.01" min="0" ... />
   ```
2. The **edit-amount** form (`showEditAmount`):
   ```jsx
   <input type="number" step="0.01" min="0" ... />
   ```

Entering `0` in the frontend produces `Math.round(0 * 100) = 0` pence, which is valid.

The edit-amount form is still shown for £0 memberships (in case an admin wants to confirm amount details), but submitting a £0 edit on a membership that has no Stripe subscription is a no-op (DB update only, which is fine since £0 → £0 is idempotent).

### Pause / Resume / Cancel

These operations update membership status in the DB and, where a Stripe subscription exists, update it in Stripe. A £0 membership has no subscription, so `stripeSubscriptionId` is null and the existing `if (membership.stripeSubscriptionId && ...)` guard skips all Stripe calls automatically. No changes needed.

## Testing

Backend (add to `backend/__tests__/booking.memberships.test.js` or a new `booking.memberships.zero.test.js`):

- `POST /booking/memberships` with `monthlyAmount: 0` and today's date creates a membership with `status: 'ACTIVE'`, `stripeSubscriptionId: null`, and `needsPaymentMethod: false`
- `POST /booking/memberships` with `monthlyAmount: 0` and a future start date creates a membership with `status: 'SCHEDULED'`
- `POST /booking/memberships` with `monthlyAmount: -1` returns 400
- `PATCH /:id` with `monthlyAmount: 0` on an existing membership returns 400

Frontend — manual verification:

- Admin can enter `0` in the monthly amount field (both creation and edit-amount forms) without a browser validation error
- Gymnast with a £0 membership shows as Active with no Stripe-related UI anomalies
