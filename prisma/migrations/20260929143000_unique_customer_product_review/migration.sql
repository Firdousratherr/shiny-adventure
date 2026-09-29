-- Enforce one review per customer for each product.
CREATE UNIQUE INDEX "ProductReview_productId_customerId_key"
ON "ProductReview"("productId", "customerId");
