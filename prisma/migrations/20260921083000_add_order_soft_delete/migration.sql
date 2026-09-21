-- Add soft-delete timestamp so admin can remove orders from the active order list
-- while retaining the order and its audit/payment history.
ALTER TABLE "Order" ADD COLUMN "deletedAt" TIMESTAMP(3);
