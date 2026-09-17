import Link from 'next/link';
import { db } from '../../lib/db';

export default async function Products({ searchParams }: { searchParams: { q?: string; sort?: string; page?: string } }) {
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const size = 12;
  const q = searchParams.q?.trim();
  const where = { status: 'ACTIVE' as const, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }, { category: { name: { contains: q, mode: 'insensitive' as const } } }] } : {}) };
  const orderBy = searchParams.sort === 'price-asc' ? { sellingPrice: 'asc' as const } : searchParams.sort === 'price-desc' ? { sellingPrice: 'desc' as const } : { createdAt: 'desc' as const };
  const [items, count] = await Promise.all([
    db.product.findMany({ where, orderBy, skip: (page - 1) * size, take: size, select: { id: true, name: true, slug: true, sellingPrice: true, stock: true, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, altText: true } } } }),
    db.product.count({ where }),
  ]);
  const pages = Math.ceil(count / size);
  return <main className="container py-8">
    <div className="flex items-center justify-between"><Link href="/" className="text-xl font-black">Zenvora</Link><Link href="/cart" className="font-semibold">Cart</Link></div>
    <h1 className="mt-10 text-3xl font-black">Shop</h1>
    <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><input name="q" defaultValue={q} placeholder="Search products" className="rounded-xl border bg-white px-4 py-3"/><select name="sort" defaultValue={searchParams.sort || ''} className="rounded-xl border bg-white px-4 py-3"><option value="">Newest</option><option value="price-asc">Price low → high</option><option value="price-desc">Price high → low</option></select><button className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">Search</button></form>
    {items.length === 0 ? <p className="py-20 text-center text-slate-500">No products found.</p> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((p) => <Link key={p.id} href={`/product/${p.slug}`} className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="flex h-48 items-center justify-center bg-slate-100">{p.images[0] ? <img src={p.images[0].url} alt={p.images[0].altText || p.name} className="h-full w-full object-cover" /> : <span className="text-6xl">🛍️</span>}</div><div className="p-5"><h2 className="font-bold">{p.name}</h2><p className="mt-2 font-black">₹{Number(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p><p className="mt-1 text-sm text-slate-500">{p.stock > 0 ? 'In stock' : 'Out of stock'}</p></div></Link>)}</div>}
    {pages > 1 && <div className="mt-8 flex flex-wrap justify-center gap-2">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => { const params = new URLSearchParams(); if (q) params.set('q', q); if (searchParams.sort) params.set('sort', searchParams.sort); params.set('page', String(n)); return <Link key={n} href={`/products?${params.toString()}`} className={`rounded-lg px-3 py-2 ${n === page ? 'bg-slate-900 text-white' : 'bg-white'}`}>{n}</Link>; })}</div>}
  </main>;
}
