import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import ProductAdmin from './product-admin';
export default async function ProductsAdmin(){const s=await auth();if(!s?.user?.email)redirect('/admin/login');const [products,categories]=await Promise.all([db.product.findMany({orderBy:{createdAt:'desc'},include:{category:true},take:200}),db.category.findMany({orderBy:{name:'asc'}})]);return <main className="min-h-screen bg-slate-100"><div className="container py-8"><div className="flex justify-between gap-3"><div><p className="text-sm text-slate-500">Zenvora Admin</p><h1 className="text-3xl font-black">Products & categories</h1></div><Link href="/admin/dashboard" className="font-semibold">← Dashboard</Link></div><ProductAdmin initialProducts={products.map(p=>({id:p.id,name:p.name,slug:p.slug,description:p.description||'',sellingPrice:p.sellingPrice.toString(),sourceCost:p.sourceCost?.toString()||'',stock:p.stock,categoryId:p.categoryId||'',categoryName:p.category?.name||'',featured:p.featured,status:p.status}))} categories={categories}/></div></main>}
