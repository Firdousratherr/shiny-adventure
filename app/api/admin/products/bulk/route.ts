import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
import { recordAdminAudit } from '../../../../../lib/admin-audit';
export async function POST(request: Request) {
 const admin=await requireAdminPermission('products'); if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const b=await request.json(); const ids=Array.isArray(b.ids)?b.ids.filter((x:unknown):x is string=>typeof x==='string').slice(0,100):[];
  const action=typeof b.action==='string'?b.action:'';
  if(!ids.length||!['HIDE','ACTIVATE'].includes(action))return NextResponse.json({error:'Select products and a valid action.'},{status:400});
  if(action==='ACTIVATE' && !(await requireAdminPermission('inventory'))) return NextResponse.json({error:'Inventory permission required to activate products.'},{status:403});
  const data=action==='HIDE'?{status:'HIDDEN' as const}:{status:'ACTIVE' as const};
  if(action==='ACTIVATE'){
   const products=await db.product.findMany({where:{id:{in:ids}},select:{id:true,stock:true}});
   if(products.some(p=>p.stock<=0))return NextResponse.json({error:'Cannot activate products with zero stock.'},{status:409});
  }
  const result=await db.product.updateMany({where:{id:{in:ids}},data});
  await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:`PRODUCTS_BULK_${action}`,entityType:'PRODUCT',details:{count:result.count,ids}});
  return NextResponse.json({ok:true,count:result.count});
 }catch(e){console.error(e);return NextResponse.json({error:'Unable to apply bulk product action.'},{status:500});}
}