import Link from 'next/link';
import {redirect} from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import {requireAdminPermission} from '../../../lib/admin-access';
import {db} from '../../../lib/db';
export default async function Operations(){
 const admin=await requireAdminPermission('orders');if(!admin)redirect('/admin/login');
 const [pending,support,alerts,low,priceChanges]=await Promise.all([
  db.order.count({where:{status:'PAYMENT_PENDING',deletedAt:null}}),
  db.supportTicket.count({where:{status:{not:'CLOSED'}}}),
  db.stockAlert.count({where:{notifiedAt:null}}),
  db.product.count({where:{status:'ACTIVE',stock:{lte:5}}}),
  db.marketplacePriceChange.count({where:{acknowledged:false}})
 ]);
 const cards=[['Payment review',pending,'/admin/orders'],['Support tickets',support,'/admin/support'],['Stock alerts',alerts,'/admin/inventory'],['Low stock',low,'/admin/inventory'],['Price changes',priceChanges,'/admin/marketplaces/history']];
 return <main className="min-h-screen bg-slate-100"><AdminNav active="dashboard"/><div className="container py-8"><div className="flex justify-between gap-4"><div><p className="text-sm font-bold text-indigo-600">Control center</p><h1 className="text-3xl font-black">Operations Center</h1><p className="mt-2 text-slate-500">Current operational items requiring attention.</p></div><Link href="/admin/dashboard" className="font-semibold">← Dashboard</Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label,value,href])=><Link key={String(label)} href={String(href)} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-2 text-xs font-bold text-indigo-600">Open →</p></Link>)}</div></div></main>;
}