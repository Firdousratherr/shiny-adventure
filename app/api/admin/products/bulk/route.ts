import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
import { recordAdminAudit } from '../../../../../lib/admin-audit';

export async function POST(request: Request) {
 const admin=await requireAdminPermission('products'); if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const b=await request.json(); const ids=Array.isArray(b.ids)?b.ids.filter((x:unknown):x is string=>typeof x==='string').slice(0,100):[];
  const action=typeof b.action==='string'?b.action:'';
  if(!ids.length||!['HIDE','ACTIVATE','DELETE'].includes(action))return NextResponse.json({error:'Select products and a valid action.'},{status:400});
  if(action==='ACTIVATE' && !(await requireAdminPermission('inventory'))) return NextResponse.json({error:'Inventory permission required to activate products.'},{status:403});

  if(action==='DELETE'){
   const products=await db.product.findMany({
    where:{id:{in:ids}},
    select:{id:true,name:true,orderItems:{select:{id:true},take:1},inventoryMovements:{select:{id:true},take:1}},
   });
   const eligible=products.filter(p=>!p.orderItems.length&&!p.inventoryMovements.length);
   const blocked=products.filter(p=>p.orderItems.length||p.inventoryMovements.length).map(p=>({id:p.id,name:p.name}));
   if(eligible.length){
    await db.$transaction(async tx=>{
     const eligibleIds=eligible.map(p=>p.id);
     await tx.productImage.deleteMany({where:{productId:{in:eligibleIds}}});
     await tx.product.deleteMany({where:{id:{in:eligibleIds}}});
    });
    await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRODUCTS_BULK_DELETE',entityType:'PRODUCT',details:{count:eligible.length,ids:eligible.map(p=>p.id),blocked}});
   }
   return NextResponse.json({ok:true,count:eligible.length,deletedIds:eligible.map(p=>p.id),blocked});
  }

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