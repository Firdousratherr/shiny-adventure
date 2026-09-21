CREATE TABLE "MarketplacePriceChange" (
  "id" TEXT NOT NULL,
  "marketplaceProductId" TEXT NOT NULL,
  "previousCost" DECIMAL(12,2) NOT NULL,
  "currentCost" DECIMAL(12,2) NOT NULL,
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplacePriceChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceImportLog" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "productId" TEXT,
  "externalId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "title" TEXT,
  "status" TEXT NOT NULL,
  "automatic" BOOLEAN NOT NULL DEFAULT false,
  "sourceCost" DECIMAL(12,2),
  "sellingPrice" DECIMAL(12,2),
  "importedImages" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceImportLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketplaceProduct"
  ADD COLUMN "lastSourceCost" DECIMAL(12,2),
  ADD COLUMN "sourceAvailability" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "lastCheckError" TEXT;

CREATE INDEX "MarketplacePriceChange_marketplaceProductId_createdAt_idx"
  ON "MarketplacePriceChange"("marketplaceProductId","createdAt");
CREATE INDEX "MarketplacePriceChange_acknowledged_createdAt_idx"
  ON "MarketplacePriceChange"("acknowledged","createdAt");
CREATE INDEX "MarketplaceImportLog_integrationId_createdAt_idx"
  ON "MarketplaceImportLog"("integrationId","createdAt");
CREATE INDEX "MarketplaceImportLog_status_createdAt_idx"
  ON "MarketplaceImportLog"("status","createdAt");
CREATE INDEX "MarketplaceImportLog_productId_idx"
  ON "MarketplaceImportLog"("productId");

ALTER TABLE "MarketplacePriceChange"
  ADD CONSTRAINT "MarketplacePriceChange_marketplaceProductId_fkey"
  FOREIGN KEY ("marketplaceProductId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceImportLog"
  ADD CONSTRAINT "MarketplaceImportLog_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "MarketplaceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
