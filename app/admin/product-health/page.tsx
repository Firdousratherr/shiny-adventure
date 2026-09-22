import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';

type Issue = { key: string; label: string; severity: 'critical'|'warning'|'info' };

function inspect(p: any): Issue[] {
  const issues: Issue[] = [];
  if (!p.images.length) issues.push({key:'images',label:'No product images',severity:'critical'});
  if (!p.description?.trim()) issues.push({key:'description',label:'Missing description',severity:'warning'});
  if (!p.categoryId) issues.push({key:'category',label:'No category',severity:'warning'});
  if (!p.sourceUrl) issues.push({key:'source',label:'Missing source URL',severity:'info'});
  if (p.sourceCost === null) issues.push({key:'cost',label:'Missing source cost',severity:'warning'});
  if (!p.metaTitle?.trim()) issues.push({key:'metaTitle',label:'Missing SEO title',severity:'warning'});
  if (!p.metaDescription?.trim()) issues.push({key:'metaDescription',label:'Missing SEO description',severity:'warning'});
  if (p.sellingPrice <= 0) issues.push({key:'price',label:'Invalid selling price',severity:'critical'});
  if (p.sourceCost !== null && p.sellingPrice > 0 && p.sellingPrice <= p.sourceCost) issues.push({key:'margin',label:'Selling price is at or below source cost',severity:'critical'});
  if (p.status === 'ACTIVE' && p.stock <= 0) issues.push({key:'stock',label:'Active product has zero stock',severity:'critical'});
  return issues;
}

export default async function ProductHealthPage() {
  const admin = await requireAdminPermission('products');
  if (!admin) redirect('/admin/login');
  const products = await db.product.findMany({
    orderBy: { updatedAt: 'desc' }, take: 1000,
    select: { id:true,name:true,slug:true,status:true,stock:true,sellingPrice:true,sourceCost:true,sourceUrl:true,description:true,metaTitle:true,metaDescription:true,categoryId:true,images:{select:{id:true}} }
  });
  const rows = products.map(p => ({...p, issues: inspect(p)}));
  const critical = rows.filter(r=>r.issues.some(i=>i.severity==='critical')).length;
  const warning = rows.filter(r=>r.issues.some(i=>i.severity==='warning')).length;
  const healthy = rows.filter(r=>r.issues.length===0).length;
  const counts = new Map<string,number>();
  for (const r of rows) for (const i of r.issues) counts.set(i.key,(counts.get(i.key)||0)+1);
  const topIssues = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  return <main className="min-h-screen bg-slate-100"><AdminNav active="products"/><div className="container py-7 md:py-9">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-violet-500">Catalog quality</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">Product Health Center</h1><p className="mt-2 text-sm text-slate-500">A deterministic quality scan for content, pricing, inventory and storefront readiness.</p></div><Link href="/admin/products" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Products →</Link></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Healthy</p><p className="mt-2 text-3xl font-black text-emerald-600">{healthy}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Critical issues</p><p className="mt-2 text-3xl font-black text-red-600">{critical}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Needs attention</p><p className="mt-2 text-3xl font-black text-amber-600">{warning}</p></div></div>
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black">Most common issues</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{topIssues.map(([key,count])=><div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{key}</p><p className="mt-1 text-xl font-black">{count}</p></div>)}</div></section>
    <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="font-black">Products needing attention</h2></div><div className="divide-y">{rows.filter(r=>r.issues.length).slice(0,200).map(r=><div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link href={'/admin/products?product='+r.id} className="truncate font-black hover:underline">{r.name}</Link><p className="mt-1 text-xs text-slate-500">₹{Number(r.sellingPrice).toFixed(2)} · Stock {r.stock} · {r.status}</p></div><div className="flex flex-wrap gap-1.5">{r.issues.map(i=><span key={i.key} className={i.severity==='critical'?'rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-700':i.severity==='warning'?'rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700':'rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700'}>{i.label}</span>)}</div></div>)}</div></section>
    {!rows.some(r=>r.issues.length)&&<div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center font-bold text-emerald-800">All scanned products passed the current health checks.</div>}
    <p className="mt-4 text-xs text-slate-400">Scan covers the latest {products.length} products. It does not claim that product copy, images or legal/commercial claims are factually correct.</p>
  </div></main>;
}