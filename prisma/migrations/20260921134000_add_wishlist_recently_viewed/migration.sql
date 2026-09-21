CREATE TABLE "Wishlist" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RecentlyViewed" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT,
  "productId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecentlyViewed_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId","productId");
CREATE INDEX "Wishlist_userId_createdAt_idx" ON "Wishlist"("userId","createdAt");
CREATE INDEX "RecentlyViewed_userId_viewedAt_idx" ON "RecentlyViewed"("userId","viewedAt");
CREATE INDEX "RecentlyViewed_sessionId_viewedAt_idx" ON "RecentlyViewed"("sessionId","viewedAt");
CREATE INDEX "RecentlyViewed_productId_viewedAt_idx" ON "RecentlyViewed"("productId","viewedAt");
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentlyViewed" ADD CONSTRAINT "RecentlyViewed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentlyViewed" ADD CONSTRAINT "RecentlyViewed_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
