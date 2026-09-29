ALTER TABLE "MarketplaceIntegration" ADD COLUMN "syncLockToken" TEXT;
ALTER TABLE "MarketplaceIntegration" ADD COLUMN "syncLockAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "MarketplaceIntegration_syncLockToken_key" ON "MarketplaceIntegration"("syncLockToken");
