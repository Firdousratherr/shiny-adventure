import Link from 'next/link';
import {redirect} from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import {requireAdminPermission} from '../../../lib/admin-access';
import {db} from '../../../lib/db';
export default async function AdminSupport(){
 const admin=await requireAdminPermission('orders');if(!admin)redirect('/admin/login');
 const tickets=await db.supportTicket.findMany({orderBy:{createdAt:'desc'},take:100,include:{customer:{select:{name:true,email:true}},order:{select:{orderNumber:true}}}});
 return <main className="min-h-screen bg-slate-100"><AdminNav active="orders"/><div className="container py-8"><div className="flex justify-between"><div><p className="text-sm font-bold text-indigo-600">Customer care</p><h1 className="text-3xl font-black">Support tickets</h1></div><Link href="/admin/operations" className="font-semibold">← Operations</Link></div><div className="mt-6 space-y-4">{!tickets.length&&<div className="rounded-2xl bg-white p-8 text-center text-slate-500">No support tickets.</div>}{tickets.map(t=><article key={t.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs font-bold text-indigo-600">{t.ticketNumber} · {t.category}</span><h2 className="mt-1 text-lg font-black">{t.subject}</h2><p className="mt-2 text-sm text-slate-600">{t.message}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{t.status}</span></div><p className="mt-4 text-xs text-slate-500">{t.customer?.name||'Guest'} · {t.customer?.email||'—'} {t.order?.orderNumber&&'· '+t.order.orderNumber}</p>{t.adminReply&&<p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>Reply:</b> {t.adminReply}</p>}</article>)}</div></div></main>;
}