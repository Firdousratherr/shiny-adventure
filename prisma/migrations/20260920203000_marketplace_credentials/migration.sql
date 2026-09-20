ALTER TABLE "MarketplaceIntegration"
ADD COLUMN "settings" JSONB,
ADD COLUMN "credentialsEncrypted" TEXT,
ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "lastSyncDurationMs" INTEGER;
