CREATE TABLE IF NOT EXISTS "MarketplaceIntegration" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "autoSync" BOOLEAN NOT NULL DEFAULT false,
  "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
  "lastSyncAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastError" TEXT,
  "importedProducts" INTEGER NOT NULL DEFAULT 0,
  "importedOrders" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceIntegration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceIntegration_provider_key" ON "MarketplaceIntegration"("provider");

CREATE TABLE IF NOT EXISTS "MarketplaceProduct" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "productId" TEXT,
  "title" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "rawData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceProduct_integrationId_externalId_key" ON "MarketplaceProduct"("integrationId","externalId");
CREATE INDEX IF NOT EXISTS "MarketplaceProduct_productId_idx" ON "MarketplaceProduct"("productId");
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "MarketplaceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MarketplaceOrder" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "orderId" TEXT,
  "status" TEXT,
  "rawData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceOrder_integrationId_externalId_key" ON "MarketplaceOrder"("integrationId","externalId");
CREATE INDEX IF NOT EXISTS "MarketplaceOrder_orderId_idx" ON "MarketplaceOrder"("orderId");
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "MarketplaceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MarketplaceSyncRun" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "productsFound" INTEGER NOT NULL DEFAULT 0,
  "ordersFound" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketplaceSyncRun_integrationId_startedAt_idx" ON "MarketplaceSyncRun"("integrationId","startedAt");
CREATE INDEX IF NOT EXISTS "MarketplaceSyncRun_status_startedAt_idx" ON "MarketplaceSyncRun"("status","startedAt");
ALTER TABLE "MarketplaceSyncRun" ADD CONSTRAINT "MarketplaceSyncRun_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "MarketplaceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
