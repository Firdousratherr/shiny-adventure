import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
import { recordAdminAudit } from '../../../../../lib/admin-audit';

export async function POST(request: Request) {
 const admin=await requireAdminPermission('products'); if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const b=await request.json(); const ids=Array.isArray(b.ids)?b.ids.filter((x:unknown):x is string=>typeof x==='string').slice(0,100):[];
  const action=typeof b.action==='string'?b.action:'';
  if(!ids.length||!['HIDE','ACTIVATE','DELETE','CATEGORY','PRICE_ADJUST'].includes(action))return NextResponse.json({error:'Select products and a valid action.'},{status:400});
  if(action==='ACTIVATE' && !(await requireAdminPermission('inventory'))) return NextResponse.json({error:'Inventory permission required to activate products.'},{status:403});
  if(action==='CATEGORY'){
   const categoryId=typeof b.categoryId==='string'?b.categoryId:'';
   if(!categoryId)return NextResponse.json({error:'Choose a category.'},{status:400});
   const category=await db.category.findUnique({where:{id:categoryId},select:{id:true,name:true}});
   if(!category)return NextResponse.json({error:'Category not found.'},{status:404});
   const result=await db.product.updateMany({where:{id:{in:ids}},data:{categoryId}});
   await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRODUCTS_BULK_CATEGORY',entityType:'PRODUCT',details:{count:result.count,ids,categoryId,categoryName:category.name}});
   return NextResponse.json({ok:true,count:result.count,categoryId,categoryName:category.name});
  }
  if(action==='PRICE_ADJUST'){
   const pricing=await requireAdminPermission('pricing'); if(!pricing)return NextResponse.json({error:'Pricing permission required.'},{status:403});
   const percent=Number(b.percent); const fixed=Number(b.fixedAmount||0);
   if(!Number.isFinite(percent)||percent<-100||percent>500||!Number.isFinite(fixed))return NextResponse.json({error:'Enter a valid percentage and fixed amount.'},{status:400});
   const products=await db.product.findMany({where:{id:{in:ids}},select:{id:true,sellingPrice:true,sourceCost:true,name:true}});
   const changes=products.map(p=>{const next=Math.round((Number(p.sellingPrice)*(1+percent/100)+fixed)*100)/100;return {...p,next};});
   if(changes.some(x=>x.next<0.01))return NextResponse.json({error:'The adjustment would create a zero or negative price.'},{status:400});
   await db.$transaction(async tx=>{for(const c of changes){await tx.product.update({where:{id:c.id},data:{sellingPrice:new Prisma.Decimal(c.next)}});await tx.productPriceHistory.create({data:{productId:c.id,sourceCost:c.sourceCost,oldSellingPrice:c.sellingPrice,newSellingPrice:new Prisma.Decimal(c.next),markupPercent:c.sourceCost&&Number(c.sourceCost)>0?new Prisma.Decimal(((c.next/Number(c.sourceCost)-1)*100).toFixed(2)):null,reason:'Bulk price adjustment',changedBy:admin.email}});}});
   await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRODUCTS_BULK_PRICE_ADJUST',entityType:'PRODUCT',details:{count:changes.length,ids,percent,fixedAmount:fixed}});
   return NextResponse.json({ok:true,count:changes.length,prices:changes.map(c=>({id:c.id,sellingPrice:c.next}))});
  }
  if(action==='DELETE'){
   const products=await db.product.findMany({where:{id:{in:ids}},select:{id:true,name:true,orderItems:{select:{id:true},take:1},inventoryMovements:{select:{id:true},take:1}}});
   const eligible=products.filter(p=>!p.orderItems.length&&!p.inventoryMovements.length);
   const blocked=products.filter(p=>p.orderItems.length||p.inventoryMovements.length).map(p=>({id:p.id,name:p.name}));
   if(eligible.length){await db.$transaction(async tx=>{const eligibleIds=eligible.map(p=>p.id);await tx.productImage.deleteMany({where:{productId:{in:eligibleIds}}});await tx.product.deleteMany({where:{id:{in:eligibleIds}}});});await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRODUCTS_BULK_DELETE',entityType:'PRODUCT',details:{count:eligible.length,ids:eligible.map(p=>p.id),blocked}});}
   return NextResponse.json({ok:true,count:eligible.length,deletedIds:eligible.map(p=>p.id),blocked});
  }
  const data=action==='HIDE'?{status:'HIDDEN' as const}:{status:'ACTIVE' as const};
  if(action==='ACTIVATE'){const products=await db.product.findMany({where:{id:{in:ids}},select:{id:true,stock:true}});if(products.some(p=>p.stock<=0))return NextResponse.json({error:'Cannot activate products with zero stock.'},{status:409});}
  const result=await db.product.updateMany({where:{id:{in:ids}},data});
  await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:`PRODUCTS_BULK_${action}`,entityType:'PRODUCT',details:{count:result.count,ids}});
  return NextResponse.json({ok:true,count:result.count});
 }catch(e){console.error(e);return NextResponse.json({error:'Unable to apply bulk product action.'},{status:500});}
}