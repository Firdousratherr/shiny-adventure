CREATE TABLE "AdminNotification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminNotification_readAt_createdAt_idx" ON "AdminNotification"("readAt","createdAt");
CREATE INDEX "AdminNotification_dismissedAt_createdAt_idx" ON "AdminNotification"("dismissedAt","createdAt");
CREATE INDEX "AdminNotification_type_createdAt_idx" ON "AdminNotification"("type","createdAt");
