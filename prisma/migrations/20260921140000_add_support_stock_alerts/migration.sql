CREATE TABLE "SupportTicket" (
 "id" TEXT NOT NULL,
 "ticketNumber" TEXT NOT NULL,
 "customerId" TEXT,
 "orderId" TEXT,
 "subject" TEXT NOT NULL,
 "category" TEXT NOT NULL,
 "message" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'OPEN',
 "adminReply" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StockAlert" (
 "id" TEXT NOT NULL,
 "productId" TEXT NOT NULL,
 "customerId" TEXT,
 "email" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "notifiedAt" TIMESTAMP(3),
 CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_customerId_createdAt_idx" ON "SupportTicket"("customerId","createdAt");
CREATE INDEX "SupportTicket_orderId_createdAt_idx" ON "SupportTicket"("orderId","createdAt");
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status","createdAt");
CREATE UNIQUE INDEX "StockAlert_productId_email_key" ON "StockAlert"("productId","email");
CREATE INDEX "StockAlert_productId_notifiedAt_idx" ON "StockAlert"("productId","notifiedAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
