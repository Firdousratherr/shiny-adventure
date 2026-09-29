-- Remove race-created duplicate customer reviews while preserving the newest review.
DELETE FROM "ProductReview" older
USING "ProductReview" newer
WHERE older."productId" = newer."productId"
  AND older."customerId" = newer."customerId"
  AND older."customerId" IS NOT NULL
  AND (older."createdAt", older."id") < (newer."createdAt", newer."id");

-- Enforce one review per customer for each product going forward.
CREATE UNIQUE INDEX "ProductReview_productId_customerId_key"
ON "ProductReview"("productId", "customerId");
