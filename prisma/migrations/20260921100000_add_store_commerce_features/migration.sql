ALTER TABLE "Product" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN "canonicalUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
CREATE INDEX "Order_couponCode_idx" ON "Order"("couponCode");
CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PERCENT',
  "value" DECIMAL(12,2) NOT NULL,
  "minOrderAmount" DECIMAL(12,2),
  "maxDiscount" DECIMAL(12,2),
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_enabled_expiresAt_idx" ON "Coupon"("enabled","expiresAt");
CREATE TABLE "StoreBanner" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "buttonText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreBanner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreBanner_enabled_sortOrder_idx" ON "StoreBanner"("enabled","sortOrder");