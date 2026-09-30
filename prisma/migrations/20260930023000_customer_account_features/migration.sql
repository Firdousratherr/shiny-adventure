CREATE TABLE "CustomerNotification" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "orderId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerNotification_customerId_createdAt_idx" ON "CustomerNotification"("customerId","createdAt");
CREATE INDEX "CustomerNotification_customerId_readAt_createdAt_idx" ON "CustomerNotification"("customerId","readAt","createdAt");
CREATE TABLE "CustomerPaymentPreference" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'UPI_MANUAL',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPaymentPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerPaymentPreference_customerId_key" ON "CustomerPaymentPreference"("customerId");
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPaymentPreference" ADD CONSTRAINT "CustomerPaymentPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
