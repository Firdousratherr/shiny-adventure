import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';

async function admin() { const s = await auth(); return s?.user?.email || null; }
const slugify = (s:string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);

export async function POST(request:Request){
  const email=await admin(); if(!email)return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const b=await request.json(); const name=typeof b.name==='string'?b.name.trim():''; const description=typeof b.description==='string'?b.description.trim():null;
    const slug=typeof b.slug==='string'&&b.slug.trim()?slugify(b.slug):slugify(name); const price=typeof b.sellingPrice==='string'||typeof b.sellingPrice==='number'?new Prisma.Decimal(String(b.sellingPrice)):null;
    if(!name||!slug||!price||price.isNegative())return NextResponse.json({error:'Name, valid selling price and slug are required.'},{status:400});
    const stock=Number.isInteger(b.stock)?b.stock:Number(b.stock); if(!Number.isInteger(stock)||stock<0)return NextResponse.json({error:'Stock must be a non-negative integer.'},{status:400});
    const status=['DRAFT','ACTIVE','HIDDEN','OUT_OF_STOCK'].includes(b.status)?b.status:'DRAFT';
    const product=await db.product.create({data:{name,slug,description,sellingPrice:price,sourceCost:b.sourceCost!==undefined&&b.sourceCost!==''?new Prisma.Decimal(String(b.sourceCost)):null,stock,categoryId:b.categoryId||null,featured:Boolean(b.featured),status}});
    return NextResponse.json({product},{status:201});
  }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'A product with this slug already exists.'},{status:409}); console.error(e);return NextResponse.json({error:'Unable to create product.'},{status:500});}
}

export async function PATCH(request:Request){
 const email=await admin();if(!email)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const b=await request.json();const id=typeof b.id==='string'?b.id:'';if(!id)return NextResponse.json({error:'Product ID is required.'},{status:400});const data:any={};for(const k of ['name','description','categoryId'])if(b[k]!==undefined)data[k]=typeof b[k]==='string'?b[k].trim()||null:b[k];if(b.sellingPrice!==undefined)data.sellingPrice=new Prisma.Decimal(String(b.sellingPrice));if(b.sourceCost!==undefined)data.sourceCost=b.sourceCost===''||b.sourceCost===null?null:new Prisma.Decimal(String(b.sourceCost));if(b.stock!==undefined){const n=Number(b.stock);if(!Number.isInteger(n)||n<0)return NextResponse.json({error:'Invalid stock.'},{status:400});data.stock=n;}if(b.featured!==undefined)data.featured=Boolean(b.featured);if(b.status!==undefined&&['DRAFT','ACTIVE','HIDDEN','OUT_OF_STOCK'].includes(b.status))data.status=b.status;if(b.slug!==undefined)data.slug=slugify(String(b.slug));const product=await db.product.update({where:{id},data});return NextResponse.json({product});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return NextResponse.json({error:'Slug already exists.'},{status:409});if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2025')return NextResponse.json({error:'Product not found.'},{status:404});console.error(e);return NextResponse.json({error:'Unable to update product.'},{status:500});}
}