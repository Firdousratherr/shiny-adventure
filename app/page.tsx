import Link from 'next/link';
import { auth } from '../auth';
import { db } from '../lib/db';
import StoreHeader from '../components/store-header';
import ProductCard from '../components/product-card';
import { productImageUrl } from '../lib/product-image-url';

function safeBannerHref(value: string | null) {
  if (!value) return '/products';
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : '/products';
  } catch {
    return '/products';
  }
}

const categories = [
  ['👗', 'Fashion', 'fashion', 'Everyday style'],
  ['🎧', 'Electronics', 'electronics', 'Smart essentials'],
  ['🛋️', 'Home & Living', 'home', 'Comfort upgrades'],
  ['💄', 'Beauty', 'beauty', 'Fresh self-care'],
  ['🍳', 'Kitchen', 'kitchen', 'Useful picks'],
  ['🎮', 'Toys & Games', 'toys-games', 'Fun for everyone'],
] as const;

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user?.email;
  const now = new Date();

  const [banners, products] = await Promise.all([
    db.storeBanner.findMany({
      where: { enabled: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 3,
    }),
    db.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, name: true, slug: true, sellingPrice: true, stock: true,
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, altText: true } },
      },
    }),
  ]);

  const heroProducts = products.slice(0, 3);

  return (
    <main className="store-dark min-h-screen overflow-x-hidden pb-28 text-slate-900 sm:pb-0">
      <StoreHeader loggedIn />

      <section className="zenvora-vibrant-hero relative isolate text-white">
        <div className="container relative z-10 grid min-h-[565px] items-center gap-8 py-10 lg:grid-cols-[.93fr_1.07fr] lg:py-14">
          <div className="zenvora-reveal max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.22em] text-violet-100 shadow-lg backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.8)]" />
              Fresh drops · built for everyday
            </span>

            <h1 className="mt-6 text-[3.2rem] font-black leading-[.97] tracking-[-.055em] sm:text-6xl lg:text-[5.4rem]">
              Big deals.
              <span className="block bg-gradient-to-r from-white via-fuchsia-100 to-cyan-200 bg-clip-text text-transparent">Bigger savings.</span>
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-7 text-violet-100/85 sm:text-lg">
              Discover trending products, useful essentials and easy shopping in one colorful place.
              Browse, compare and checkout with confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-black text-violet-800 shadow-2xl shadow-black/20 hover:-translate-y-1">
                Shop now <span>→</span>
              </Link>
              <Link href="/products?sort=price-desc" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur hover:bg-white/15">
                Explore deals <span>✦</span>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {['Secure checkout', 'Easy returns', 'Fast support'].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-black/10 px-3 py-2 text-[10px] font-bold text-violet-100 backdrop-blur">{item}</span>
              ))}
            </div>
          </div>

          <div className="relative hidden min-h-[500px] items-center justify-center lg:flex">
            <div className="absolute right-12 top-6 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div className="absolute bottom-5 left-8 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />

            <div className="zenvora-hero-product relative w-full max-w-[610px] rounded-[38px] p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-violet-100">Zenvora spotlight</span>
                <span className="rounded-full bg-fuchsia-300 px-3 py-1.5 text-[9px] font-black text-violet-950 shadow-lg">TRENDING NOW</span>
              </div>

              <div className="relative mt-4 h-[330px]">
                {heroProducts[0]?.images[0] ? (
                  <img src={productImageUrl(heroProducts[0].images[0].url) || ''} alt="" className="absolute left-[9%] top-8 h-[250px] w-[42%] object-contain" />
                ) : <div className="absolute left-[12%] top-16 text-[8rem]">🎧</div>}
                {heroProducts[1]?.images[0] ? (
                  <img src={productImageUrl(heroProducts[1].images[0].url) || ''} alt="" className="absolute right-[10%] top-20 h-[215px] w-[38%] object-contain" />
                ) : <div className="absolute right-[10%] top-24 text-[7rem]">⌚</div>}
                {heroProducts[2]?.images[0] ? (
                  <img src={productImageUrl(heroProducts[2].images[0].url) || ''} alt="" className="zenvora-float absolute bottom-0 left-[36%] h-[190px] w-[32%] object-contain" />
                ) : <div className="zenvora-float absolute bottom-0 left-[37%] text-[6rem]">👟</div>}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {(heroProducts.length ? heroProducts : [
                  { id: 'a', name: 'Trending pick', sellingPrice: 799, stock: 1, category: { name: 'Featured' } },
                  { id: 'b', name: 'Smart everyday', sellingPrice: 1299, stock: 1, category: { name: 'Featured' } },
                  { id: 'c', name: 'Fresh arrival', sellingPrice: 899, stock: 1, category: { name: 'Featured' } },
                ]).map((product) => (
                  <div key={product.id} className="rounded-2xl border border-white/10 bg-black/10 p-3 backdrop-blur">
                    <p className="truncate text-[10px] font-bold text-violet-100/70">{product.category?.name || 'Featured'}</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{product.name}</p>
                    <p className="mt-1 text-xs font-bold text-cyan-200">From ₹{Number(product.sellingPrice).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container relative z-20 -mt-7">
        <div className="zenvora-benefit-strip rounded-3xl p-3 sm:p-4">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['🚚', 'Free shipping', 'On eligible orders'],
              ['💳', 'Secure payments', 'Protected checkout'],
              ['↻', 'Easy returns', 'Simple support'],
              ['⚡', 'Fast support', 'We are here to help'],
            ].map(([icon, title, detail]) => (
              <div key={title} className="benefit flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-lg">{icon}</span>
                <div>
                  <p className="text-xs font-black text-slate-900">{title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="zenvora-section-kicker text-[10px] font-black uppercase">Shop the mood</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em] text-slate-900 sm:text-4xl">Top categories</h2>
            <p className="mt-2 text-sm text-slate-500">Start with a collection, then refine with search and filters.</p>
          </div>
          <Link href="/products" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:border-violet-300 hover:text-violet-700 sm:inline-flex">View all →</Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map(([icon, label, slug, detail]) => (
            <Link key={slug} href={'/products?category=' + slug} className="zenvora-category-card group rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 via-fuchsia-100 to-cyan-50 text-2xl">{icon}</span>
                <span className="text-slate-300 transition group-hover:text-violet-600">↗</span>
              </div>
              <p className="mt-4 text-sm font-black text-slate-900">{label}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
            </Link>
          ))}
        </div>
      </section>

      {banners.length > 0 ? (
        <section className="container pb-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {banners.map((banner, index) => (
              <Link key={banner.id} href={safeBannerHref(banner.linkUrl)} className={'zenvora-deal-banner relative min-h-[220px] overflow-hidden rounded-[28px] p-6 ' + (index === 0 ? 'lg:col-span-2' : '')}>
                {banner.imageUrl ? <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-multiply" /> : null}
                <div className="relative z-10 max-w-lg">
                  <span className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-600">Limited-time spotlight</span>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{banner.title}</h2>
                  {banner.subtitle ? <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{banner.subtitle}</p> : null}
                  {banner.buttonText ? <span className="mt-5 inline-flex rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-500 px-4 py-2.5 text-xs font-black text-white shadow-lg">{banner.buttonText} →</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="zenvora-section-kicker text-[10px] font-black uppercase">Fresh from the marketplace</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em] text-slate-900 sm:text-4xl">Trending now</h2>
            <p className="mt-2 text-sm text-slate-500">Popular and newly added products from your catalog.</p>
          </div>
          <Link href="/products" className="hidden rounded-full bg-violet-50 px-4 py-2.5 text-xs font-black text-violet-700 hover:bg-violet-100 sm:inline-flex">View all products →</Link>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
          {!products.length ? (
            <div className="zenvora-empty-state col-span-full">
              <div className="text-5xl">🛍️</div>
              <p className="mt-4 text-lg font-black">Your catalog is getting ready</p>
              <p className="mt-2 text-sm text-slate-500">Published products will appear here.</p>
              <Link href="/products" className="mt-5 inline-flex rounded-full bg-violet-700 px-5 py-3 text-xs font-black text-white">Explore store</Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="container pb-16">
        <div className="rounded-[30px] bg-slate-950 p-6 text-white shadow-2xl shadow-violet-950/10 sm:p-9">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">The Zenvora promise</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">A cleaner shopping experience from discovery to delivery.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Clear product details, secure order creation and support surfaces designed to keep the important things easy to find.</p>
            </div>
            <Link href="/products" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-black text-slate-950 hover:-translate-y-1">Start exploring →</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="brand-mark brand-lockup text-3xl font-black tracking-[-.05em]"><span className="z-logo-badge" aria-hidden="true">Z</span><span>Zenvora<span className="text-fuchsia-500">.</span></span></Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">Everyday products, clearer shopping and a storefront designed around convenience.</p>
          </div>
          <div><h3 className="text-sm font-black text-slate-900">Shop</h3><div className="mt-4 space-y-2 text-sm text-slate-500"><Link href="/products">All products</Link><Link className="block" href="/products?sort=price-desc">Deals</Link><Link className="block" href="/track">Track order</Link></div></div>
          <div><h3 className="text-sm font-black text-slate-900">Account</h3><div className="mt-4 space-y-2 text-sm text-slate-500"><Link className="block" href="/account">My Zenvora</Link><Link className="block" href="/cart">Cart</Link><Link className="block" href={loggedIn ? '/account/addresses' : '/login'}>{loggedIn ? 'Saved addresses' : 'Sign in'}</Link></div></div>
          <div><h3 className="text-sm font-black text-slate-900">Need help?</h3><p className="mt-4 text-sm leading-6 text-slate-500">Use order tracking or your account to manage purchases and delivery details.</p></div>
        </div>
        <div className="border-t border-slate-100"><div className="container py-5 text-xs text-slate-400">© {new Date().getFullYear()} Zenvora. All rights reserved.</div></div>
      </footer>
    </main>
  );
}
