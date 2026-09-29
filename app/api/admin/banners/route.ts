import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

function safeBannerLink(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 500);
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(){const a=await requireAdminPermission('settings');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({banners:await db.storeBanner.findMany({orderBy:[{sortOrder:'asc'},{createdAt:'desc'}],take:100})});}
export async function POST(request:Request){const a=await requireAdminPermission('settings');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});try{const b=await request.json();if(typeof b.title!=='string'||!b.title.trim())return NextResponse.json({error:'Title is required.'},{status:400});const banner=await db.storeBanner.create({data:{title:b.title.trim().slice(0,160),subtitle:typeof b.subtitle==='string'?b.subtitle.trim().slice(0,300)||null:null,imageUrl:typeof b.imageUrl==='string'?b.imageUrl.trim().slice(0,1000)||null:null,linkUrl:safeBannerLink(b.linkUrl),buttonText:typeof b.buttonText==='string'?b.buttonText.trim().slice(0,60)||null:null,sortOrder:Number.isInteger(Number(b.sortOrder))?Number(b.sortOrder):0,enabled:b.enabled!==false}});return NextResponse.json({banner},{status:201});}catch{return NextResponse.json({error:'Unable to create banner.'},{status:500});}}
export async function PATCH(request:Request){const a=await requireAdminPermission('settings');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});try{const b=await request.json();const data:any={};for(const k of ['title','subtitle','imageUrl','buttonText'])if(b[k]!==undefined)data[k]=b[k]===null?null:String(b[k]).trim().slice(0,k==='title'?160:k==='buttonText'?60:1000)||null;
if(b.linkUrl!==undefined)data.linkUrl=safeBannerLink(b.linkUrl);if(b.sortOrder!==undefined)data.sortOrder=Number(b.sortOrder)||0;if(b.enabled!==undefined)data.enabled=Boolean(b.enabled);const banner=await db.storeBanner.update({where:{id:String(b.id)},data});return NextResponse.json({banner});}catch{return NextResponse.json({error:'Unable to update banner.'},{status:400});}}
export async function DELETE(request:Request){const a=await requireAdminPermission('settings');if(!a)return NextResponse.json({error:'Unauthorized'},{status:401});try{const b=await request.json();await db.storeBanner.delete({where:{id:String(b.id)}});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Banner not found.'},{status:404});}}