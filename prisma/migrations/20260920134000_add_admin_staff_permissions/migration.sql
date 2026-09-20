ALTER TABLE "AdminUser" ADD COLUMN "accessRole" TEXT NOT NULL DEFAULT 'STAFF';
ALTER TABLE "AdminUser" ADD COLUMN "permissions" JSONB;
UPDATE "AdminUser" SET "accessRole" = 'SUPER_ADMIN' WHERE LOWER("email") = LOWER(COALESCE(current_setting('app.admin_email', true), ''));
