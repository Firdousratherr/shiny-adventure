ALTER TABLE "AdminUser" ADD COLUMN "accessRole" TEXT NOT NULL DEFAULT 'STAFF';
ALTER TABLE "AdminUser" ADD COLUMN "permissions" JSONB;
UPDATE "AdminUser" SET "accessRole" = 'SUPER_ADMIN' WHERE "accessRole" = 'STAFF';
