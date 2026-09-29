import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdminPermission } from '../../../../lib/admin-access';
const text=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
function couponNumbers(b:any){
  const value=Number(b.value);
  const minOrderAmount=b.minOrderAmount===''||b.minOrderAmount==null?null:Number(b.minOrderAmount);
  const maxDiscount=b.maxDiscount===''||b.maxDiscount==null?null:Number(b.maxDiscount);
  const usageLimit=b.usageLimit===''||b.usageLimit==null?null:Number(b.usageLimit);
  if(!Number.isFinite(value)||value<=0)return null;
  if((b.type==='PERCENT')&&value>100)return null;
  if(minOrderAmount!==null&&(!Number.isFinite(minOrderAmount)||minOrderAmount<0))return null;
  if(maxDiscount!==null&&(!Number.isFinite(maxDiscount)||maxDiscount<0))return null;
  if(usageLimit!==null&&(!Number.isSafeInteger(usageLimit)||usageLimit<1))return null;
  const startsAt=b.startsAt?new Date(b.startsAt):null;
  const expiresAt=b.expiresAt?new Date(b.expiresAt):null;
  if((startsAt&&!Number.isFinite(startsAt.getTime()))||(expiresAt&&!Number.isFinite(expiresAt.getTime())))return null;
  if(startsAt&&expiresAt&&expiresAt<=startsAt)return null;
  return {value,minOrderAmount,maxDiscount,usageLimit,startsAt,expiresAt};
}
export async function GET(){const a=await requireAdminPermission('pricing');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});const {db}=await import('../../../../lib/db');return NextResponse.json({coupons:await db.coupon.findMany({orderBy:{createdAt:'desc'},take:200})});}
export async function POST(request:Request){
  const a=await requireAdminPermission('pricing');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {db}=await import('../../../../lib/db');
  try{
    const b=await request.json();
    const code=text(b.code).toUpperCase();
    const type=b.type==='FIXED'?'FIXED':'PERCENT';
    const numbers=couponNumbers({...b,type});
    if(!code||!numbers)return NextResponse.json({error:'Invalid coupon details.'},{status:400});
    const coupon=await db.coupon.create({data:{code,type,value:new Prisma.Decimal(numbers.value),minOrderAmount:numbers.minOrderAmount===null?null:new Prisma.Decimal(numbers.minOrderAmount),maxDiscount:numbers.maxDiscount===null?null:new Prisma.Decimal(numbers.maxDiscount),usageLimit:numbers.usageLimit,startsAt:numbers.startsAt,expiresAt:numbers.expiresAt,enabled:b.enabled!==false}});
    return NextResponse.json({coupon},{status:201});
  }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'Coupon code already exists.'},{status:409});return NextResponse.json({error:'Unable to create coupon.'},{status:500});}
}

export async function PATCH(request:Request){
  const a=await requireAdminPermission('pricing');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {db}=await import('../../../../lib/db');
  try{
    const b=await request.json();
    if(!b.id)return NextResponse.json({error:'Coupon ID is required.'},{status:400});
    const current=await db.coupon.findUnique({where:{id:String(b.id)}});
    if(!current)return NextResponse.json({error:'Coupon not found.'},{status:404});
    const merged={...current,...b,type:b.type===undefined?current.type:b.type};
    const numbers=couponNumbers(merged);
    const data:any={};
    if(b.code!==undefined){const code=text(b.code).toUpperCase();if(!code)return NextResponse.json({error:'Coupon code is required.'},{status:400});data.code=code;}
    if(b.type!==undefined)data.type=merged.type;
    if(b.value!==undefined||b.minOrderAmount!==undefined||b.maxDiscount!==undefined||b.usageLimit!==undefined||b.startsAt!==undefined||b.expiresAt!==undefined){
      if(!numbers)return NextResponse.json({error:'Invalid coupon details.'},{status:400});
      data.value=new Prisma.Decimal(numbers.value);
      data.minOrderAmount=numbers.minOrderAmount===null?null:new Prisma.Decimal(numbers.minOrderAmount);
      data.maxDiscount=numbers.maxDiscount===null?null:new Prisma.Decimal(numbers.maxDiscount);
      data.usageLimit=numbers.usageLimit;
      data.startsAt=numbers.startsAt;
      data.expiresAt=numbers.expiresAt;
    }
    if(b.enabled!==undefined){if(typeof b.enabled!=='boolean')return NextResponse.json({error:'Invalid enabled value.'},{status:400});data.enabled=b.enabled;}
    const coupon=await db.coupon.update({where:{id:String(b.id)},data});
    return NextResponse.json({coupon});
  }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'Coupon code already exists.'},{status:409});return NextResponse.json({error:'Unable to update coupon.'},{status:400});}
}

export async function DELETE(request:Request){const a=await requireAdminPermission('pricing');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});const {db}=await import('../../../../lib/db');try{const b=await request.json();await db.coupon.delete({where:{id:String(b.id)}});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Coupon not found.'},{status:404});}}