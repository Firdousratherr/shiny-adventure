# Zenvora

Production-oriented Indian e-commerce/reselling store built with Next.js 14, PostgreSQL/Neon, Prisma, Auth.js, Zod, Vercel Blob, Upstash Redis and Nodemailer.

## Architecture

- **Storefront:** mobile-first product catalogue, search, categories, cart and checkout.
- **Orders:** server-side price/stock calculation, sequential order numbers and immutable status history.
- **Payments:** manual UPI verification; Razorpay is optional and protected by server-side signature/webhook verification.
- **Inventory:** stock is committed when payment is confirmed. Cancellation/RTO restocking is transactional and recorded in `InventoryMovement`.
- **Admin:** authenticated product, category, payment, order, shipping, RTO and refund management.
- **Privacy:** supplier URLs/costs, source order IDs, admin notes and internal profit data remain server-side/admin-only.
- **Uploads:** product images are public storefront assets; payment proofs are private admin-only Blob objects.
- **Security:** Zod validation, Auth.js credentials authentication, bcrypt password hashing, same-origin protection, security headers and distributed rate limiting when Upstash is configured.

## Requirements

- Node.js 20+
- PostgreSQL/Neon
- Vercel Blob
- Upstash Redis
- SMTP provider (optional for email notifications)
- Razorpay credentials (optional)

## Environment variables

Copy `.env.example` to `.env.local` for local development. Never commit secrets.

Required for normal deployment:

```text
DATABASE_URL
DIRECT_URL
AUTH_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
BLOB_READ_WRITE_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_SITE_URL
```

Email notifications require:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

Razorpay requires:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

Razorpay can remain disabled if it is not configured/enabled in store settings.

## Local development

```bash
npm ci
npm run db:generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

The seed script is intended for development/demo data. It refuses to run in production unless `ALLOW_PRODUCTION_SEED=true` is explicitly supplied. Do **not** use it to initialize a production store unless you intentionally want its sample products/settings and admin credentials.

## Verification before deployment

```bash
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Actions runs these checks automatically for the configured project branches and pull requests.

## Production database

For an existing production database, apply committed migrations with:

```bash
npm run db:migrate
```

This runs `prisma migrate deploy`; it does not create or alter migrations interactively.

## Vercel deployment

1. Import `Firdousratherr/shiny-adventure` into Vercel.
2. Select the intended deployment branch.
3. Add the environment variables above to the appropriate Vercel environments.
4. Connect the production Neon database.
5. Apply Prisma migrations before exposing the store to customers.
6. Configure Vercel Blob and Upstash Redis.
7. Configure SMTP if customer status emails are desired.
8. If Razorpay is enabled, configure its webhook endpoint and signing secret.
9. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS site URL.
10. Test the complete checkout, payment verification, inventory, order tracking, shipping, RTO and refund flows on the deployed environment before accepting real orders.

## Operational notes

- Never expose source URLs, source costs, supplier information, payment-proof URLs, admin notes or internal profit calculations to customer-facing code.
- Manual UPI payments are **not** automatically trusted from customer submissions; an admin must verify them.
- RTO from `SHIPPED` automatically restores ordered quantities and records an inventory movement.
- Email notification failures must not roll back order transactions.
- Keep production secrets only in Vercel/Neon/provider secret stores.
