import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';
export default async function InventoryPage(){
 const admin=await requireAdminPermission('inventory'); if(!admin)redirect('/admin/login');
 const threshold=5;
 const products=await db.product.findMany({where:{status:{in:['ACTIVE','OUT_OF_STOCK']},stock:{lte:threshold}},orderBy:{stock:'asc'},take:200,select:{id:true,name:true,slug:true,stock:true,sellingPrice:true,status:true,category:{select:{name:true}}}});
 return <main className="min-h-screen bg-slate-100"><AdminNav active="products"/><div className="container py-8"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-amber-600 font-bold">Inventory</p><h1 className="text-3xl font-black">Low-stock products</h1><p className="mt-2 text-sm text-slate-500">Products at or below {threshold} units.</p></div><Link href="/admin/products" className="font-semibold">← Products</Link></div><div className="mt-6 space-y-3">{!products.length&&<div className="rounded-2xl bg-white p-8 text-center text-slate-500">No low-stock products.</div>}{products.map(p=><article key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm"><div><h2 className="font-black">{p.name}</h2><p className="text-sm text-slate-500">{p.category?.name||'Uncategorized'} · {p.status}</p></div><div className="text-right"><p className={`text-2xl font-black ${p.stock===0?'text-red-600':'text-amber-600'}`}>{p.stock}</p><p className="text-xs text-slate-400">units remaining</p></div></article>)}</div></div></main>;
}