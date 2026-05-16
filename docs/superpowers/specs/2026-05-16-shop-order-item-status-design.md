# Per-item status on shop orders

Date: 2026-05-16

## Problem

Today a shop order has a single status across the order: `PENDING_PAYMENT →
ORDERED → ARRIVED → FULFILLED`. There's no way to record that the club has
placed the upstream order with the supplier — `ORDERED` already means
"customer paid us". And because suppliers can differ between line items in
the same order, we need to track each item independently. An admin
currently can't tick off "the t-shirt has been ordered with Champion" while
still waiting on a different item from a different supplier.

## Design

### Schema

- New Prisma enum `ShopOrderItemStatus`:
  `AWAITING | ORDERED_FROM_SUPPLIER | ARRIVED | FULFILLED`.
- `ShopOrderItem` gains two columns:
  - `status ShopOrderItemStatus @default(AWAITING)`
  - `supplier String?` — free-text admin note (e.g. "Champion", "Amazon").
- Order-level `ShopOrderStatus` is unchanged. `PENDING_PAYMENT` and
  `ORDERED` remain the payment gate. `ARRIVED` and `FULFILLED` at the
  order level become **derived** from the item statuses.

Migration:

1. Add the enum, column, and default `AWAITING`.
2. Backfill: for orders whose status is already `ARRIVED`, set all items to
   `ARRIVED`; for `FULFILLED`, set all items to `FULFILLED`. Other orders
   stay `AWAITING`.

### Backend

- New endpoint:
  - `PATCH /api/shop-admin/orders/:orderId/items/:itemId` —
    body `{ status?, supplier? }`. Status transitions are not strictly
    enforced (admins fix mistakes); we just validate against the enum.
  - In the same call we recompute the parent order's status:
    - All items `FULFILLED` → order `FULFILLED`.
    - Else all items `ARRIVED` or `FULFILLED` (none below `ARRIVED`) → order `ARRIVED`.
    - Otherwise stays `ORDERED` (if previously `ORDERED+` — never goes back
      to `PENDING_PAYMENT`).
- Existing per-order `PATCH /api/shop-admin/orders/:id` (the "Mark arrived /
  Mark collected" handler) is removed; the admin UI no longer drives
  order-level status directly.
- Webhook flow (customer payment) is unchanged: still flips order to
  `ORDERED` and leaves all items at `AWAITING`.
- `GET /api/shop-admin/orders` and `GET /api/booking/shop/my-orders`
  responses include each item's `status` and `supplier`.

### Frontend (admin)

`AdminShopOrders.js`:

- Tabs stay (`ALL / ORDERED / ARRIVED / FULFILLED`) and filter by the
  derived order status.
- Each order card lists its items as a small table:
  - Columns: product (with size, qty, customisation), supplier (inline
    text input), status pill, action button.
  - The action button advances the item one step forward:
    `AWAITING → ORDERED_FROM_SUPPLIER → ARRIVED → FULFILLED`. No backward
    button by default; admin can drop into the status pill itself which
    exposes a small dropdown for corrections.
- New `ShopOrderItemStatus` constants + labels in the file.

### Frontend (customer-facing `MyOrders.js`)

- Each item row gets a small status pill alongside the existing per-order
  badge so the customer can see "Champion t-shirt: ordered from supplier"
  while another item shows "Arrived at club".
- No new tabs at customer level.

### API helpers (`shopApi.js`)

- New `updateShopOrderItem(orderId, itemId, { status, supplier })`.
- Old `updateShopOrderStatus(orderId, status)` removed.

## Out of scope

- Customer email notifications on item status changes.
- Tracking numbers, shipping costs, multiple suppliers per item.
- Supplier picklist (autocomplete / saved list). Free text only for now.
- Backward enum transitions guarded server-side.

## Tests

Backend Jest:

1. PATCH item status: `ORDERED_FROM_SUPPLIER`, `ARRIVED`, `FULFILLED`
   each round-trip.
2. PATCH item supplier text persists and is returned by list endpoint.
3. Derived order status flips to `ARRIVED` when all items reach `ARRIVED`;
   flips to `FULFILLED` when all reach `FULFILLED`.
4. Mixed item statuses leave the order at `ORDERED`.
5. Non-admin/coach receives 403 on the PATCH.
6. Backfill migration: an existing `ARRIVED` order's items become
   `ARRIVED`. Cover via a script test or one-off.
