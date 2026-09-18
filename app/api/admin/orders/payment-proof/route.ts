import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';
import { get } from '@vercel/blob';

export async function GET(request:Request){
 const session=await auth(); if(session?.user?.role!=='admin')return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=new URL(request.url); const orderNumber=url.searchParams.get('orderNumber')||'';
 if(!/^ORD-\d{4}-\d{4,}$/i.test(orderNumber))return NextResponse.json({error:'Invalid order number.'},{status:400});
 const order=await db.order.findUnique({where:{orderNumber:orderNumber.toUpperCase()},select:{paymentScreenshotUrl:true}});
 if(!order?.paymentScreenshotUrl)return NextResponse.json({error:'Payment proof not found.'},{status:404});
 try{const result=await get(order.paymentScreenshotUrl,{access:'private'});if(!result||result.statusCode!==200||!result.stream)return NextResponse.json({error:'Payment proof not found.'},{status:404});return new NextResponse(result.stream,{status:200,headers:{'Content-Type':result.blob.contentType||'application/octet-stream','Cache-Control':'private, no-store','Content-Disposition':'inline','X-Content-Type-Options':'nosniff'}})}catch(error){console.error('payment proof access failed',error);return NextResponse.json({error:'Unable to load payment proof.'},{status:500})}
}
