# Zenvora Architecture Map

## Runtime
- Next.js 14 App Router + React 18 + TypeScript
- PostgreSQL + Prisma 5
- Auth.js/NextAuth credentials + optional Google OAuth
- Razorpay payment flow plus manual UPI proof flow
- Vercel Blob for product media
- Upstash Redis for rate limiting when configured
- Tailwind CSS for storefront/admin UI

## Surface map
- Storefront: `app/page.tsx`, `app/products`, `app/product/[slug]`
- Commerce: `app/cart`, `app/checkout`, `app/payment`, `app/track`
- Customer: `app/account`, profile, addresses, wishlist/recently-viewed/reviews/support
- Admin: dashboard, operations, products, inventory, orders, payments, pricing, marketplaces, suppliers, customers, support, analytics, automation, staff, approvals, audit, settings
- API: 64 route handlers under `app/api`
- Domain services: `lib/orders`, `lib/inventory*`, `lib/pricing`, `lib/admin-access`, `lib/marketplace*`, `lib/security`, `lib/validation`

## Critical invariants
1. Prices, stock, permissions and order state are server-authoritative.
2. Inventory reservation happens transactionally during order creation.
3. Payment confirmation must be idempotent and must verify the payment against the server order.
4. Admin permissions are checked against the database, not only the client UI.
5. Product imports must preserve source identity and avoid duplicate marketplace products.
6. Production database changes use committed Prisma migrations.

## Current improvement program
### Phase 1 — Reliability and platform UX
- Global loading/error/not-found states
- SEO sitemap/robots
- Product engagement UI for recently viewed/reviews
- Preserve reduced-motion accessibility
- Keep checkout/payment and inventory flows server-authoritative

### Phase 2 — Storefront conversion
- Better product discovery/search suggestions
- Review summaries and verified-review presentation
- Recently viewed and wishlist surfaces
- Stock-alert UX
- Better empty/loading/error states
- Product image/gallery performance and fallbacks

### Phase 3 — Admin command center
- Unified status/health indicators
- Safer bulk operations with previews and confirmations
- Better import diagnostics and retry visibility
- Order/payment workflow guardrails
- Marketplace sync history and actionable failures

### Phase 4 — Security and correctness
- Audit every mutation route for server-side authorization
- Tighten rate-limit behavior on abuse-prone endpoints
- Validate all external URLs and uploaded media
- Add transaction/idempotency tests around checkout, payment, inventory and imports
- Add regression tests for permission boundaries

### Phase 5 — Performance and observability
- Review database indexes against real filters/orderBy fields
- Reduce unnecessary client-side fetching
- Add stable caching/revalidation where safe
- Improve structured error logging without leaking secrets
- Keep CI responsible for generate → migrate → typecheck → lint → tests → build

## Important known constraint
Vercel's current status check may fail independently because of the account/build-rate-limit restriction. That is deployment infrastructure, not evidence that a source-code change is invalid.
