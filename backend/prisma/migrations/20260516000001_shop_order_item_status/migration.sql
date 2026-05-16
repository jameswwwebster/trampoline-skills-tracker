CREATE TYPE "ShopOrderItemStatus" AS ENUM ('AWAITING', 'ORDERED_FROM_SUPPLIER', 'ARRIVED', 'FULFILLED');

ALTER TABLE "shop_order_items"
  ADD COLUMN "status"   "ShopOrderItemStatus" NOT NULL DEFAULT 'AWAITING',
  ADD COLUMN "supplier" TEXT;

-- Backfill: align existing items with their order's state.
UPDATE "shop_order_items" SET "status" = 'ARRIVED'
  WHERE "orderId" IN (SELECT "id" FROM "shop_orders" WHERE "status" = 'ARRIVED');
UPDATE "shop_order_items" SET "status" = 'FULFILLED'
  WHERE "orderId" IN (SELECT "id" FROM "shop_orders" WHERE "status" = 'FULFILLED');
