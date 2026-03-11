# Shop Feature Design

**Date:** 2026-03-11

## Goal

Build a kit shop integrated into the existing booking section of the Trampoline Life app. Members log in, browse products, add to a separate shop cart, and pay via Stripe. Coaches and admins manage orders through an admin view with status tracking and automatic email notifications.

## Architecture

- Hardcoded product catalogue (9 products, rarely changes)
- Separate shop cart from booking cart (different item types, different fulfilment)
- Reuses existing Stripe infrastructure and BookingLayout
- ShopOrder created on checkout, confirmed via Stripe webhook
- Status flow: PENDING_PAYMENT → ORDERED → ARRIVED → FULFILLED

## Routes

| Route | Page | Access |
|---|---|---|
| `/booking/shop` | Product listing | Member |
| `/booking/shop/:productId` | Product detail | Member |
| `/booking/shop/cart` | Cart + Stripe checkout | Member |
| `/booking/shop/confirmation/:orderId` | Order confirmation | Member |
| `/booking/my-orders` | Member order history | Member |
| `/booking/admin/shop-orders` | Admin order management | Coach/Admin |

## Data Model

```prisma
enum ShopOrderStatus {
  PENDING_PAYMENT
  ORDERED
  ARRIVED
  FULFILLED
}

model ShopOrder {
  id                    String          @id @default(cuid())
  userId                String
  user                  User            @relation(fields: [userId], references: [id])
  status                ShopOrderStatus @default(PENDING_PAYMENT)
  stripePaymentIntentId String
  total                 Int             // pence
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  items                 ShopOrderItem[]
}

model ShopOrderItem {
  id            String    @id @default(cuid())
  orderId       String
  order         ShopOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId     String
  productName   String
  size          String
  quantity      Int
  customisation String?
  price         Int       // pence per item
}
```

## Backend API

| Method | Route | Role | Purpose |
|---|---|---|---|
| `POST` | `/api/booking/shop/orders` | Member | Create pending ShopOrder + Stripe PaymentIntent |
| `GET` | `/api/booking/shop/my-orders` | Member | Own order history (ORDERED/ARRIVED/FULFILLED) |
| `GET` | `/api/booking/shop/admin/orders` | Coach/Admin | All orders, filterable by status |
| `PATCH` | `/api/booking/shop/admin/orders/:id/status` | Coach/Admin | Advance status, trigger email |

Webhook extended to handle `payment_intent.succeeded` for ShopOrders (identified by checking ShopOrder table for paymentIntentId).

## Email Notifications

- **ORDERED** (on webhook): "Thanks for your order — we'll let you know when your kit arrives at the club."
- **ARRIVED** (on admin action): "Your kit order has arrived at the club. Collect it at your next session."
- **FULFILLED** (on admin action): "Your kit order has been collected. Enjoy!"

## Product Catalogue

9 products hardcoded in `frontend/src/pages/booking/shop/shopProducts.js` and mirrored in `backend/data/shopProducts.js` for server-side price validation.

Products: Hoodie, T-Shirt, Leggings, Tapered Joggers, Tracksuit Bottoms, Shorts, Women's Leotard, Men's Leotard, Scrunchie.

Size guides stored as structured text (headers + rows) within the product definition. Leotards link to https://www.milano-pro-sport.com/size-guides-i31 in addition to inline data.

## Access Control

- Shop pages: any logged-in user (Member, Parent, Coach, Admin)
- Order management: Coach and Admin roles (`requireRole(['CLUB_ADMIN', 'COACH'])`)
- Members can only see their own orders
