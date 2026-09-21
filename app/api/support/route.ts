import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
export async function GET() {
  const session=await auth(); if(session?.user?.role!=='customer'||!session.user.email)return NextResponse.json({error:'Unauthorized'},{status:401});
  const customer=await db.customerUser.findUnique({where:{email:session.user.email},select:{id:true}}); if(!customer)return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json({tickets:await db.supportTicket.findMany({where:{customerId:customer.id},orderBy:{createdAt:'desc'}})});
}
export async function POST(request:Request) {
  const session=await auth(); if(session?.user?.role!=='customer'||!session.user.email)return NextResponse.json({error:'Unauthorized'},{status:401});
  const customer=await db.customerUser.findUnique({where:{email:session.user.email},select:{id:true}}); if(!customer)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json().catch(()=>({}));
  const subject=typeof body.subject==='string'?body.subject.trim().slice(0,120):'';
  const message=typeof body.message==='string'?body.message.trim().slice(0,3000):'';
  const category=typeof body.category==='string'?body.category.trim().slice(0,40):'GENERAL';
  const orderNumber=typeof body.orderNumber==='string'?body.orderNumber.trim().toUpperCase():'';
  if(!subject||message.length<5)return NextResponse.json({error:'Subject and message are required.'},{status:400});
  const order=orderNumber?await db.order.findFirst({where:{orderNumber,email:session.user.email},select:{id:true}}):null;
  const ticketNumber='TKT-'+Date.now().toString(36).toUpperCase();
  const ticket=await db.supportTicket.create({data:{ticketNumber,customerId:customer.id,orderId:order?.id??null,subject,message,category}});
  await db.adminNotification.create({data:{type:'SUPPORT',title:'New support ticket',message:ticketNumber+' · '+subject,entityType:'SupportTicket',entityId:ticket.id}});
  return NextResponse.json(ticket,{status:201});
}