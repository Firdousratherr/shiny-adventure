# Indian Dropshipping Store

Production-oriented Next.js 14 + PostgreSQL/Neon + Prisma e-commerce platform with manual UPI verification.

## Stack
Next.js 14, TypeScript, React, Tailwind CSS, Prisma, PostgreSQL/Neon, Auth.js, Zod, Vercel Blob, Nodemailer, Upstash Redis.

## Status
Initial application foundation. Configure environment variables before production use.

## Local setup
1. Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env` and configure secrets.
4. `npx prisma migrate dev --name init`
5. `npm run db:seed`
6. `npm run dev`

Never commit `.env` or production secrets.

## Vercel
Import the GitHub repository into Vercel and configure the environment variables from `.env.example`. Use Neon for PostgreSQL, Vercel Blob for uploads, Upstash Redis for distributed rate limiting, and an SMTP provider for email.
