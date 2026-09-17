import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { trackingSchema } from '../../../../lib/validation';

const WINDOW_MS=10*60*1000; const MAX_ATTEMPTS=10;
const attempts=new Map<string,{count:number;reset:number}>();
function isLimited(key:string){const now=Date.now();const x=attempts.get(key);if(!x||now>=x.reset){attempts.set(key,{count:1,reset:now+WINDOW_MS});return false}x.count+=1;return x.count>MAX_ATTEMPTS}
export async function POST(request:Request){
 try{
  const parsed=trackingSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:'Enter a valid order number and phone number.'},{status:400});
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'unknown';
  if(isLimited(`${ip}:${parsed.data.phone}`))return NextResponse.json({error:'Too many tracking attempts. Please try again later.'},{status:429});
  const order=await db.order.findFirst({where:{orderNumber:parsed.data.orderNumber,phone:parsed.data.phone},select:{orderNumber:true,status:true,createdAt:true,updatedAt:true,courierName:true,trackingNumber:true,trackingUrl:true,items:{select:{productName:true,quantity:true,unitPrice:true}},history:{orderBy:{createdAt:'asc'},select:{oldStatus:true,newStatus:true,note:true,createdAt:true}}}});
  if(!order)return NextResponse.json({error:'Order not found. Check the details and try again.'},{status:404});
  return NextResponse.json(order);
 }catch(error){console.error('tracking failed',error);return NextResponse.json({error:'Unable to track your order right now.'},{status:500});}
}
