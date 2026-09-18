ALTER TABLE "Product"
  ADD COLUMN "reservedStock" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "paymentAccessTokenHash" TEXT;

CREATE UNIQUE INDEX "Order_paymentAccessTokenHash_key"
  ON "Order"("paymentAccessTokenHash");

CREATE INDEX "Order_reservationExpiresAt_idx"
  ON "Order"("reservationExpiresAt");
