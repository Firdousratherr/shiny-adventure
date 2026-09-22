import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';

const normalize=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export default async function DuplicateDetectorPage(){
  const admin=await requireAdminPermission('products'); if(!admin) redirect('/admin/login');
  const products=await db.product.findMany({orderBy:{updatedAt:'desc'},take:2000,select:{id:true,name:true,slug:true,sourceUrl:true,sellingPrice:true,stock:true}});
  const byName=new Map<string,any[]>(), bySource=new Map<string,any[]>();
  for(const p of products){const n=normalize(p.name);if(n){const a=byName.get(n)||[];a.push(p);byName.set(n,a);}if(p.sourceUrl){const u=p.sourceUrl.trim().toLowerCase();const a=bySource.get(u)||[];a.push(p);bySource.set(u,a);}}
  const groups=new Map<string,{reason:string,products:any[]}>();
  for(const [k,v] of byName) if(v.length>1) groups.set('name:'+k,{reason:'Same normalized product name',products:v});
  for(const [k,v] of bySource) if(v.length>1) groups.set('source:'+k,{reason:'Same source URL',products:v});
  const result=[...groups.values()].sort((a,b)=>b.products.length-a.products.length);
  return <main className="min-h-screen bg-slate-100"><AdminNav active="products"/><div className="container py-7 md:py-9">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-violet-500">Catalog integrity</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">Duplicate Detector</h1><p className="mt-2 text-sm text-slate-500">Find exact duplicate names and source URLs before they create catalog clutter.</p></div><Link href="/admin/products" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Products →</Link></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Duplicate groups</p><p className="mt-2 text-3xl font-black">{result.length}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Products involved</p><p className="mt-2 text-3xl font-black">{new Set(result.flatMap(g=>g.products.map(p=>p.id))).size}</p></div></div>
    <section className="mt-6 space-y-3">{!result.length&&<div className="rounded-2xl bg-emerald-50 p-7 text-center font-bold text-emerald-800">No exact duplicate groups found in the scanned catalog.</div>}{result.map((g,i)=><article key={i} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Potential duplicate</span><h2 className="mt-1 font-black">{g.reason}</h2></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{g.products.length} products</span></div><div className="mt-4 divide-y rounded-xl border">{g.products.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><Link href={'/admin/products?product='+p.id} className="font-bold hover:underline">{p.name}</Link><p className="text-[10px] text-slate-500">{p.sourceUrl||'No source URL'} · Stock {p.stock}</p></div><span className="text-sm font-black">₹{Number(p.sellingPrice).toFixed(2)}</span></div>)}</div></article>)}</section>
    <p className="mt-4 text-xs text-slate-400">This scan detects exact normalized names and exact source URLs. Similar-looking products can require human review.</p>
  </div></main>;
}