import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../lib/db';
import AddToCart from '../../../components/add-to-cart';
import WishlistButton from '../../../components/wishlist-button';
import ProductEngagement from '../../../components/product-engagement';
import ProductGallery from '../../../components/product-gallery';
import StoreHeader from '../../../components/store-header';
import { productImageUrl } from '../../../lib/product-image-url';
import { productDescriptionText } from '../../../lib/product-description';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await db.product.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      canonicalUrl: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
    },
  });
  if (!p) return {};
  return {
    title: p.metaTitle || p.name,
    description: p.metaDescription || p.description || 'Shop ' + p.name + ' online at Zenvora.',
    alternates: p.canonicalUrl ? { canonical: p.canonicalUrl } : undefined,
    openGraph: {
      title: p.metaTitle || p.name,
      description: p.metaDescription || p.description || undefined,
      images: p.images[0] ? [p.images[0].url] : [],
    },
  };
}

export default async function Product({ params }: { params: { slug: string } }) {
  const p = await db.product.findFirst({
    where: { slug: params.slug, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sellingPrice: true,
      stock: true,
      images: { orderBy: { sortOrder: 'asc' }, select: { url: true, altText: true } },
    },
  });
  if (!p) notFound();

  const description = productDescriptionText(p.description) || 'Quality product selected for the Zenvora marketplace.';
  const image = productImageUrl(p.images[0]?.url);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description,
    image: p.images.map(item => productImageUrl(item.url)).filter(Boolean),
    brand: { '@type': 'Brand', name: 'Zenvora' },
    sku: p.id,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: Number(p.sellingPrice).toFixed(2),
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://zenvora-online.vercel.app').replace(/\/$/, '')}/product/${encodeURIComponent(p.slug)}`,
    },
  };
  const structuredDataJson = JSON.stringify(structuredData).replace(/</g, '\\u003c');

  return (
    <main className="store-dark min-h-screen pb-28 sm:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredDataJson }} />
      <StoreHeader />

      <div className="container py-5 sm:py-8">
        <nav className="flex items-center gap-2 overflow-hidden text-xs text-slate-500">
          <Link href="/" className="shrink-0 hover:text-white">Home</Link>
          <span>/</span>
          <Link href="/products" className="shrink-0 hover:text-white">Shop</Link>
          <span>/</span>
          <span className="truncate text-slate-300">{p.name}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
          <section>
            <ProductGallery images={p.images} name={p.name} stock={p.stock} />
          </section>

          <section className="lg:sticky lg:top-24 lg:h-fit">
            <div className="zenvora-detail-panel">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-fuchsia-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-700">Zenvora edit</span>
                {p.stock > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">In stock</span>
                ) : (
                  <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black text-rose-700">Out of stock</span>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-black leading-[1.02] tracking-[-.04em] sm:text-5xl">{p.name}</h1>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black tracking-tight sm:text-4xl">₹{Number(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <p className="mt-1 text-xs text-slate-500">Final price shown before secure checkout.</p>
                </div>
                {p.stock > 0 && p.stock <= 5 ? <span className="rounded-2xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950">Only {p.stock} left</span> : null}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  ['🔒', 'Secure', 'checkout'],
                  ['🚚', 'Fast', 'delivery'],
                  ['↻', 'Easy', 'returns'],
                ].map(([icon, title, detail]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="text-lg">{icon}</span>
                    <p className="mt-1 text-[11px] font-black">{title}</p>
                    <p className="text-[10px] text-slate-500">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-slate-500">About this product</p>
                  <span className="text-[10px] font-bold text-slate-600">Product details</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{description}</p>
              </div>

              <div className="mt-7 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs font-black text-violet-200">Ready when you are.</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Add it to your cart, review the order, and continue to secure payment.</p>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-3">
                <AddToCart product={{ id: p.id, name: p.name, price: Number(p.sellingPrice), image, stock: p.stock }} />
              </div>

              <div className="mt-3">
                <WishlistButton productId={p.id} />
              </div>
            </div>
          </section>
        </div>

        <ProductEngagement productId={p.id} stock={p.stock} />
      </div>

      <div className="zenvora-sticky-action fixed inset-x-0 bottom-0 px-3 py-3 sm:hidden">
        <AddToCart product={{ id: p.id, name: p.name, price: Number(p.sellingPrice), image, stock: p.stock }} />
      </div>
    </main>
  );
}
