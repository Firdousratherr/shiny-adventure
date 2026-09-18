CREATE TABLE "SignupOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignupOtp_email_key" ON "SignupOtp"("email");
CREATE INDEX "SignupOtp_expiresAt_idx" ON "SignupOtp"("expiresAt");
