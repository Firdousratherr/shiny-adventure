import Link from 'next/link';
import {redirect} from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import {requireAdminPermission} from '../../../lib/admin-access';
import {db} from '../../../lib/db';
import PricingAdmin from './pricing-admin';

export default async function PricingPage(){
 const a=await requireAdminPermission('pricing');
 if(!a) redirect('/admin/login');
 const [rules,categories,products]=await Promise.all([
  db.pricingRule.findMany({orderBy:[{priority:'desc'},{createdAt:'asc'}],include:{category:true}}),
  db.category.findMany({orderBy:{name:'asc'},select:{id:true,name:true}}),
  db.product.findMany({orderBy:{updatedAt:'desc'},take:500,include:{category:true},select:{id:true,name:true,sourceUrl:true,sourceCost:true,sellingPrice:true,priceLocked:true,priceLockValue:true,category:true}})
 ]);
 return <main className="min-h-screen bg-slate-100"><AdminNav active="pricing"/><div className="container py-8">
  <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-slate-500">Zenvora Admin</p><h1 className="text-3xl font-black">Pricing Manager</h1></div><Link href="/admin/products" className="font-semibold">← Products</Link></div>
  <PricingAdmin initialRules={rules.map(r=>({...r,markupPercent:r.markupPercent.toString(),fixedAmount:r.fixedAmount.toString(),minPrice:r.minPrice?.toString()||null,maxPrice:r.maxPrice?.toString()||null}))} initialCategories={categories} initialProducts={products.map(p=>({...p,sourceCost:p.sourceCost?.toString()||null,sellingPrice:p.sellingPrice.toString(),priceLockValue:p.priceLockValue?.toString()||null}))}/>
 </div></main>;
}