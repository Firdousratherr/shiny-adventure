import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../lib/db';
import AddToCart from '../../../components/add-to-cart';
import { productImageUrl } from '../../../lib/product-image-url';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await db.product.findUnique({ where: { slug: params.slug }, select: { name: true, description: true, metaTitle: true, metaDescription: true, canonicalUrl: true, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } } } });
  if (!p) return {};
  return { title: p.metaTitle || p.name, description: p.metaDescription || p.description || `Shop ${p.name} online at Zenvora.`, alternates: p.canonicalUrl ? { canonical: p.canonicalUrl } : undefined, openGraph: { title: p.metaTitle || p.name, description: p.metaDescription || p.description || undefined, images: p.images[0] ? [p.images[0].url] : [] } };
}

export default async function Product({ params }: { params: { slug: string } }) {
  const p = await db.product.findFirst({ where: { slug: params.slug, status: 'ACTIVE' }, select: { id: true, name: true, slug: true, description: true, sellingPrice: true, stock: true, images: { orderBy: { sortOrder: 'asc' }, select: { url: true, altText: true } } } });
  if (!p) notFound();
  return <main className="min-h-screen bg-[#070b16] px-4 pt-5 pb-32 text-white sm:px-6 sm:py-10 sm:pb-10">
    <div className="mx-auto max-w-6xl">
      <nav className="flex items-center justify-between border-b border-white/10 pb-4 text-sm"><div className="flex items-center gap-2 text-slate-400"><Link href="/" className="hover:text-white">Home</Link><span>/</span><Link href="/products" className="hover:text-white">Shop</Link><span>/</span><span className="max-w-[180px] truncate text-slate-200">{p.name}</span></div><Link href="/cart" className="rounded-xl border border-white/10 px-3 py-2 font-bold hover:bg-white/5">🛒 Cart</Link></nav>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
        <section><div className="zenvora-glass overflow-hidden rounded-3xl p-2 sm:p-3"><div className="grid gap-2">{p.images.length ? p.images.slice(0,6).map((image,i)=><div key={image.url} className={i===0?'relative aspect-square overflow-hidden rounded-2xl bg-white/5':'relative hidden aspect-square overflow-hidden rounded-2xl bg-white/5 sm:block'}>{<img src={productImageUrl(image.url)||''} alt={image.altText||p.name} className="h-full w-full object-cover"/>}{i===0&&p.stock<=5&&p.stock>0&&<span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950">Only {p.stock} left</span>}</div>) : <div className="flex aspect-square items-center justify-center rounded-2xl bg-white/5 text-8xl">🛍️</div>}</div></div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{p.images.slice(0,4).map((image,i)=><div key={image.url} className={i===0?'overflow-hidden rounded-xl border border-violet-400/60 bg-white/5':'overflow-hidden rounded-xl border border-white/10 bg-white/5'}><img src={productImageUrl(image.url)||''} alt="" className="aspect-square w-full object-cover"/></div>)}</div>
        </section>
        <section className="lg:sticky lg:top-20 lg:h-fit"><p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-400">Zenvora · Premium selection</p><h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{p.name}</h1><div className="mt-5 flex flex-wrap items-end gap-3"><p className="text-3xl font-black">₹{Number(p.sellingPrice).toLocaleString('en-IN',{minimumFractionDigits:2})}</p>{p.stock>0?<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">In stock</span>:<span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">Out of stock</span>}</div>
          <div className="mt-5 grid grid-cols-3 gap-2">{[['🔒','Secure','payments'],['🚚','Fast','delivery'],['↻','Easy','returns']].map(([i,a,b])=><div key={a} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"><span>{i}</span><p className="mt-1 text-xs font-bold">{a}</p><p className="text-[10px] text-slate-500">{b}</p></div>)}</div>
          <div className="mt-6"><p className="text-xs font-black uppercase tracking-widest text-slate-500">About this product</p><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-300">{p.description||'Quality product selected for the Zenvora marketplace.'}</p></div>
          <div className="mt-6 hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:block"><AddToCart product={{id:p.id,name:p.name,price:Number(p.sellingPrice),image:productImageUrl(p.images[0]?.url),stock:p.stock}} /></div>
        </section>
      </div>
      <div className="zenvora-sticky-action fixed inset-x-0 bottom-0 px-4 py-3 sm:hidden"><AddToCart product={{id:p.id,name:p.name,price:Number(p.sellingPrice),image:productImageUrl(p.images[0]?.url),stock:p.stock}} /></div>
    </div>
  </main>;
}