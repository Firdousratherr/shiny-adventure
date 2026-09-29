import Link from 'next/link';
import { auth } from '../auth';
import { db } from '../lib/db';
import { productImageUrl } from '../lib/product-image-url';
import StoreHeader from '../components/store-header';
import StoreFooter from '../components/store-footer';
import ProductCard from '../components/product-card';

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user?.email;
  const now = new Date();
  const banners = await db.storeBanner.findMany({
    where: { enabled: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 5,
  });
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, slug: true, sellingPrice: true, stock: true, category: { select: { name: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, altText: true } } },
    }),
    db.category.findMany({ where: { products: { some: { status: 'ACTIVE' } } }, orderBy: { name: 'asc' }, take: 10, select: { name: true, slug: true } }),
  ]);
  const heroProduct = products[0];

  return (
    <main id="main-content" className="store-shell">
      <StoreHeader loggedIn={loggedIn} />

      <section className="store-container pt-5 sm:pt-8">
        <div className="store-hero overflow-hidden">
          <div className="store-hero-grid" aria-hidden="true" />
          <div className="relative grid items-center gap-10 px-5 py-10 sm:px-9 sm:py-14 lg:grid-cols-[1fr_.92fr] lg:px-14 lg:py-16">
            <div className="store-reveal">
              <span className="store-eyebrow"><span className="store-eyebrow-dot" /> New season · Fresh finds</span>
              <h1 className="mt-5 max-w-2xl text-[clamp(2.8rem,6vw,5.7rem)] font-black leading-[.97] tracking-[-.055em] text-slate-950">
                Better things.<br /><span className="store-gradient-text">Better everyday.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                Discover useful, stylish and gift-worthy products with clear pricing, secure checkout and delivery across India.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/products" className="store-primary-btn">Shop the collection <span>→</span></Link>
                <Link href="/products?sort=price-desc" className="store-secondary-btn">Explore deals</Link>
              </div>
              <div className="mt-9 grid max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  ['🚚', 'Fast delivery'],
                  ['🔒', 'Secure payment'],
                  ['↻', 'Easy returns'],
                  ['💬', 'Helpful support'],
                ].map(([icon, label]) => (
                  <div key={label} className="store-mini-trust">
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px] lg:pr-3">
              <div className="store-hero-orbit one" aria-hidden="true" />
              <div className="store-hero-orbit two" aria-hidden="true" />
              <div className="store-hero-product store-float">
                <div className="store-hero-product-label">Trending now</div>
                <div className="store-hero-image">
                  {heroProduct?.images[0] ? (
                    <img src={productImageUrl(heroProduct.images[0].url) || heroProduct.images[0].url} alt="" loading="eager" />
                  ) : (
                    <span className="text-7xl font-black text-violet-300/80">Z</span>
                  )}
                </div>
                <div className="store-hero-product-info">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{heroProduct?.name || 'Curated picks for you'}</p>
                    <p className="mt-1 text-xs text-slate-500">{heroProduct?.category?.name || 'New arrivals'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-950">{heroProduct ? `₹${Number(heroProduct.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Shop now'}</p>
                    {heroProduct && <Link href={`/product/${heroProduct.slug}`} className="text-[11px] font-extrabold text-violet-700">Open product →</Link>}
                  </div>
                </div>
              </div>
              <div className="store-floating-tag tag-a">✦ Curated picks</div>
              <div className="store-floating-tag tag-b">✓ Secure checkout</div>
              <div className="store-floating-stat"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Live store</div>
            </div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="store-container py-7 sm:py-9">
          <div className="flex items-end justify-between gap-4">
            <div><p className="store-kicker">Browse</p><h2 className="store-section-title">Shop by category</h2></div>
            <Link href="/products" className="store-text-link">View all</Link>
          </div>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
            {categories.map((category, index) => (
              <Link key={category.slug} href={`/products?category=${category.slug}`} className="store-category-pill">
                <span className="store-category-icon">{['✦','◈','◌','⌂','✿','◆','◒','◇','◉','＋'][index % 10]}</span>
                <span>{category.name}</span>
                <span className="text-slate-300">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {banners.length > 0 && (
        <section className="store-container pb-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {banners.slice(0, 4).map((banner, index) => (
              <Link key={banner.id} href={banner.linkUrl || '/products'} className={`store-banner ${index === 0 ? 'lg:col-span-2 min-h-[220px]' : 'min-h-[180px]'}`}>
                {banner.imageUrl && <img src={banner.imageUrl} alt="" loading="lazy" decoding="async" />}
                <div className="store-banner-overlay" />
                <div className="relative z-10 max-w-xl">
                  <span className="store-banner-badge">Zenvora pick</span>
                  <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{banner.title}</h2>
                  {banner.subtitle && <p className="mt-2 max-w-lg text-sm leading-6 text-white/80">{banner.subtitle}</p>}
                  {banner.buttonText && <span className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950">{banner.buttonText} →</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="store-container py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div><p className="store-kicker">Fresh on Zenvora</p><h2 className="store-section-title">Trending products</h2><p className="mt-1 text-sm text-slate-500">Popular picks to explore right now.</p></div>
          <Link href="/products" className="store-text-link">See all products →</Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map(product => (
            <ProductCard key={product.id} product={{ ...product, image: product.images[0] || null }} />
          ))}
          {!products.length && <div className="store-empty col-span-full"><span>✦</span><h3>No products yet</h3><p>Published products will appear here automatically.</p></div>}
        </div>
      </section>

      <section className="store-container pb-14 sm:pb-20">
        <div className="store-service-grid">
          {[
            ['🚚','Fast delivery','Reliable delivery across India.'],
            ['🔐','Secure checkout','Your checkout stays protected.'],
            ['↻','Simple returns','A smoother post-purchase experience.'],
            ['💬','Customer support','Get help when you need it.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="store-service-card"><span className="store-service-icon">{icon}</span><div><h3>{title}</h3><p>{desc}</p></div></div>
          ))}
        </div>
      </section>

      <StoreFooter />
    </main>
  );
}
