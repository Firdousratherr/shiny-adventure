import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../lib/db';
import AddToCart from '../../../components/add-to-cart';
import WishlistButton from '../../../components/wishlist-button';
import ProductGallery from '../../../components/product-gallery';
import StoreHeader from '../../../components/store-header';
import StoreFooter from '../../../components/store-footer';
import { productImageUrl } from '../../../lib/product-image-url';
import { productDescriptionText } from '../../../lib/product-description';

function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await db.product.findFirst({
    where:{ slug:params.slug, status:'ACTIVE' },
    select:{ name:true, description:true, metaTitle:true, metaDescription:true, canonicalUrl:true, images:{orderBy:{sortOrder:'asc'},take:1,select:{url:true}} }
  });
  if (!p) return {};
  return { title:p.metaTitle||p.name, description:p.metaDescription||p.description||('Shop '+p.name+' online at Zenvora.'), alternates:p.canonicalUrl?{canonical:p.canonicalUrl}:undefined, openGraph:{title:p.metaTitle||p.name,description:p.metaDescription||p.description||undefined,images:p.images[0]?[productImageUrl(p.images[0].url)||p.images[0].url]:[]} };
}

export default async function Product({ params }: { params: { slug: string } }) {
  const p = await db.product.findFirst({
    where:{ slug:params.slug, status:'ACTIVE' },
    select:{ id:true,name:true,slug:true,description:true,sellingPrice:true,stock:true,images:{orderBy:{sortOrder:'asc'},select:{url:true,altText:true}} }
  });
  if (!p) notFound();
  const productUrl=(process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000')+'/product/'+p.slug;
  const productSchema={
    '@context':'https://schema.org','@type':'Product',name:p.name,
    description:productDescriptionText(p.description)||('Shop '+p.name+' online at Zenvora.'),
    url:productUrl,image:p.images.map(image=>image.url),
    offers:{'@type':'Offer',priceCurrency:'INR',price:Number(p.sellingPrice).toFixed(2),availability:p.stock>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',url:productUrl}
  };

  return (
    <main id="main-content" className="store-shell">
      <StoreHeader />
      <div className="store-container pb-28 pt-5 sm:pb-12 sm:pt-7">
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(productSchema)}} />
        <nav className="store-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span><Link href="/products">Shop</Link><span>/</span><span className="max-w-[220px] truncate text-slate-700">{p.name}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.03fr_.97fr] lg:gap-12">
          <section className="store-reveal">
            <ProductGallery images={p.images.map(image=>({url:productImageUrl(image.url)||'',alt:image.altText||p.name}))} name={p.name} stock={p.stock} />
          </section>

          <section className="lg:sticky lg:top-24 lg:h-fit">
            <div className="flex flex-wrap items-center gap-2">
              <span className="store-soft-badge">Zenvora selection</span>
              {p.stock>0&&p.stock<=5&&<span className="store-warn-badge">Only {p.stock} left</span>}
            </div>
            <h1 className="mt-4 text-3xl font-black leading-[1.08] tracking-[-.035em] text-slate-950 sm:text-5xl">{p.name}</h1>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <p className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">₹{Number(p.sellingPrice).toLocaleString('en-IN',{minimumFractionDigits:2})}</p>
              <span className={'store-stock-badge '+(p.stock>0?'is-good':'is-bad')}>{p.stock>0?'In stock':'Out of stock'}</span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {[['🔒','Secure','checkout'],['🚚','Reliable','delivery'],['↻','Easy','returns']].map(([icon,a,b])=><div key={a} className="store-benefit-card"><span>{icon}</span><strong>{a}</strong><small>{b}</small></div>)}
            </div>

            <div className="mt-7 border-t border-slate-200 pt-7">
              <p className="store-kicker">About this product</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:text-base">{productDescriptionText(p.description)||'A quality product selected for the Zenvora marketplace.'}</p>
            </div>

            <div className="mt-7 hidden sm:block">
              <AddToCart product={{id:p.id,name:p.name,slug:p.slug,price:Number(p.sellingPrice),image:productImageUrl(p.images[0]?.url),stock:p.stock}} />
              <div className="mt-3"><WishlistButton productId={p.id} /></div>
            </div>

            <div className="mt-7 rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
              <p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">A smoother shopping experience</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><p className="text-sm font-extrabold text-slate-900">Clear pricing</p><p className="mt-1 text-xs leading-5 text-slate-500">What you see here is the current selling price.</p></div>
                <div><p className="text-sm font-extrabold text-slate-900">Protected checkout</p><p className="mt-1 text-xs leading-5 text-slate-500">Final order totals are verified on the server.</p></div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="store-mobile-buy fixed inset-x-0 bottom-0 z-50 p-3 sm:hidden">
        <AddToCart product={{id:p.id,name:p.name,slug:p.slug,price:Number(p.sellingPrice),image:productImageUrl(p.images[0]?.url),stock:p.stock}} />
      </div>
      <StoreFooter />
    </main>
  );
}
