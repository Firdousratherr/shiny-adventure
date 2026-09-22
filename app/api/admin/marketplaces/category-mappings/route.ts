import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';

export async function GET(){
  const admin=await requireAdminPermission('marketplaces');
  if(!admin)return NextResponse.json({error:'Marketplace permission required.'},{status:403});
  const integration=await db.marketplaceIntegration.upsert({where:{provider:'SHOPIFY'},update:{},create:{provider:'SHOPIFY'}});
  const categories=await db.category.findMany({orderBy:{name:'asc'},select:{id:true,name:true,slug:true}});
  const settings=integration.settings&&typeof integration.settings==='object'&&!Array.isArray(integration.settings)?integration.settings as Record<string,unknown>:{};
  const mappings=settings.categoryMappings&&typeof settings.categoryMappings==='object'&&!Array.isArray(settings.categoryMappings)?settings.categoryMappings:{};
  return NextResponse.json({mappings,categories});
}
export async function PATCH(request:Request){
  const admin=await requireAdminPermission('marketplaces');
  if(!admin)return NextResponse.json({error:'Marketplace permission required.'},{status:403});
  try{
    const body=await request.json();
    if(!body.mappings||typeof body.mappings!=='object'||Array.isArray(body.mappings))return NextResponse.json({error:'Mappings must be an object.'},{status:400});
    const entries=Object.entries(body.mappings as Record<string,unknown>).filter(([k,v])=>typeof k==='string'&&k.trim()&&typeof v==='string'&&v.trim()).slice(0,200);
    const categoryIds=[...new Set(entries.map(([,v])=>String(v)))];
    const valid=await db.category.findMany({where:{id:{in:categoryIds}},select:{id:true}});
    const validIds=new Set(valid.map(x=>x.id));
    const mappings:Record<string,string>={};
    for(const [key,value] of entries)if(validIds.has(String(value)))mappings[key.trim().slice(0,200)]=String(value);
    const current=await db.marketplaceIntegration.findUnique({where:{provider:'SHOPIFY'},select:{id:true,settings:true}});
    const currentSettings=current?.settings&&typeof current.settings==='object'&&!Array.isArray(current.settings)?current.settings as Record<string,unknown>:{};
    const integration=await db.marketplaceIntegration.update({where:{id:current!.id},data:{settings:{...currentSettings,categoryMappings:mappings} as Prisma.InputJsonValue}});
    return NextResponse.json({success:true,mappings,settings:integration.settings});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save category mappings.'},{status:500});}
}