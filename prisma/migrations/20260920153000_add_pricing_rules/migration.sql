CREATE TABLE "PricingRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
  "provider" TEXT,
  "categoryId" TEXT,
  "markupPercent" DECIMAL(7,2) NOT NULL,
  "fixedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "minPrice" DECIMAL(12,2),
  "maxPrice" DECIMAL(12,2),
  "roundingMode" TEXT NOT NULL DEFAULT 'NONE',
  "roundingValue" DECIMAL(12,2),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductPriceHistory" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sourceCost" DECIMAL(12,2),
  "oldSellingPrice" DECIMAL(12,2) NOT NULL,
  "newSellingPrice" DECIMAL(12,2) NOT NULL,
  "markupPercent" DECIMAL(7,2),
  "reason" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "priceLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "priceLockValue" DECIMAL(12,2);

CREATE INDEX "PricingRule_scope_enabled_priority_idx" ON "PricingRule"("scope","enabled","priority");
CREATE INDEX "PricingRule_provider_enabled_idx" ON "PricingRule"("provider","enabled");
CREATE INDEX "PricingRule_categoryId_enabled_idx" ON "PricingRule"("categoryId","enabled");
CREATE INDEX "ProductPriceHistory_productId_createdAt_idx" ON "ProductPriceHistory"("productId","createdAt");

ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;