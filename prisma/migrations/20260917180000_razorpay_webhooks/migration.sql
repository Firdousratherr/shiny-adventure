ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'UPI_MANUAL';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpaySignature" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_razorpayPaymentId_key" ON "Order"("razorpayPaymentId");
CREATE INDEX IF NOT EXISTS "Order_paymentMethod_idx" ON "Order"("paymentMethod");
CREATE TABLE IF NOT EXISTS "RazorpayWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processingError" TEXT,
  CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RazorpayWebhookEvent_eventId_key" ON "RazorpayWebhookEvent"("eventId");
CREATE INDEX IF NOT EXISTS "RazorpayWebhookEvent_event_idx" ON "RazorpayWebhookEvent"("event");
CREATE INDEX IF NOT EXISTS "RazorpayWebhookEvent_receivedAt_idx" ON "RazorpayWebhookEvent"("receivedAt");
