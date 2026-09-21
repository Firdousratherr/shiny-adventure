import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';
export default async function Customers({searchParams}:{searchParams?:{q?:string}}){
 const admin=await requireAdminPermission('customers'); if(!admin) redirect('/admin/login');
 const q=(searchParams?.q||'').trim();
 const customers=await db.customerUser.findMany({where:q?{OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]}:undefined,orderBy:{createdAt:'desc'},take:200,include:{addresses:true}});
 const emails=customers.map(c=>c.email);
 const counts=emails.length?await db.order.groupBy({by:['email'],where:{email:{in:emails},deletedAt:null},_count:{_all:true},_sum:{totalAmount:true}}):[];
 const stats=new Map(counts.map(x=>[x.email||'',x]));
 return <main className="min-h-screen bg-slate-100"><AdminNav active="customers"/><div className="container py-8"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Customers</p><h1 className="text-3xl font-black">Customer management</h1></div><Link href="/admin/dashboard" className="font-semibold">← Dashboard</Link></div><form className="mt-6 flex gap-2"><input name="q" defaultValue={q} placeholder="Search name or email" className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3"/><button className="rounded-xl bg-slate-900 px-5 font-bold text-white">Search</button></form><div className="mt-6 space-y-3">{!customers.length&&<div className="rounded-2xl bg-white p-8 text-center text-slate-500">No customers found.</div>}{customers.map(c=>{const s=stats.get(c.email);return <article key={c.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-lg font-black">{c.name}</h2><p className="text-sm text-slate-500">{c.email}</p><p className="mt-1 text-xs text-slate-400">Joined {c.createdAt.toLocaleDateString('en-IN')} · {c.addresses.length} saved address(es)</p></div><div className="text-right text-sm"><p><b>{s?._count._all||0}</b> orders</p><p className="font-black">₹{Number(s?._sum.totalAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</p></div></div></article>})}</div></div></main>;
}