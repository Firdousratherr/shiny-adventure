CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");
CREATE INDEX "Supplier_status_name_idx" ON "Supplier"("status","name");

CREATE TABLE "ProductVersion" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductVersion_productId_createdAt_idx" ON "ProductVersion"("productId","createdAt");
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductReview" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "orderId" TEXT,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId","status","createdAt");
CREATE INDEX "ProductReview_status_createdAt_idx" ON "ProductReview"("status","createdAt");
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CheckoutSession" (
  "id" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "customerId" TEXT,
  "email" TEXT,
  "cartValue" DECIMAL(12,2),
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "recoveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CheckoutSession_sessionKey_key" ON "CheckoutSession"("sessionKey");
CREATE INDEX "CheckoutSession_status_createdAt_idx" ON "CheckoutSession"("status","createdAt");
CREATE INDEX "CheckoutSession_email_createdAt_idx" ON "CheckoutSession"("email","createdAt");

CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "conditions" JSONB,
  "actions" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationRule_name_key" ON "AutomationRule"("name");
CREATE INDEX "AutomationRule_enabled_event_idx" ON "AutomationRule"("enabled","event");

CREATE TABLE "FeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

CREATE TABLE "BusinessGoal" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "target" DECIMAL(14,2) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BusinessGoal_metric_periodStart_periodEnd_idx" ON "BusinessGoal"("metric","periodStart","periodEnd");

CREATE TABLE "IntegrationEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "payload" JSONB,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntegrationEvent_provider_createdAt_idx" ON "IntegrationEvent"("provider","createdAt");
CREATE INDEX "IntegrationEvent_status_createdAt_idx" ON "IntegrationEvent"("status","createdAt");

ALTER TABLE "Product" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
