import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const admin=await requireAdminPermission('orders');
  if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
  const q=new URL(request.url).searchParams.get('q')?.trim()||'';
  if(q.length<2)return NextResponse.json({results:[]});
  const [orders,products,customers,tickets]=await Promise.all([
    db.order.findMany({where:{deletedAt:null,OR:[{orderNumber:{contains:q,mode:'insensitive'}},{customerName:{contains:q,mode:'insensitive'}},{phone:{contains:q}}]},take:8,select:{id:true,orderNumber:true,customerName:true,totalAmount:true,status:true}}),
    db.product.findMany({where:{OR:[{name:{contains:q,mode:'insensitive'}},{slug:{contains:q,mode:'insensitive'}}]},take:8,select:{id:true,name:true,slug:true,status:true}}),
    db.customerUser.findMany({where:{OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]},take:8,select:{id:true,name:true,email:true}}),
    db.supportTicket.findMany({where:{OR:[{ticketNumber:{contains:q,mode:'insensitive'}},{subject:{contains:q,mode:'insensitive'}}]},take:6,select:{id:true,ticketNumber:true,subject:true,status:true}})
  ]);
  return NextResponse.json({results:[
    ...orders.map(x=>({type:'order',id:x.id,title:x.orderNumber,subtitle:`${x.customerName} · ₹${Number(x.totalAmount).toLocaleString('en-IN')} · ${x.status}`,href:'/admin/orders?q='+encodeURIComponent(x.orderNumber)})),
    ...products.map(x=>({type:'product',id:x.id,title:x.name,subtitle:x.status,href:'/admin/products'})),
    ...customers.map(x=>({type:'customer',id:x.id,title:x.name,subtitle:x.email,href:'/admin/customers?q='+encodeURIComponent(x.email)})),
    ...tickets.map(x=>({type:'support',id:x.id,title:x.ticketNumber+' · '+x.subject,subtitle:x.status,href:'/admin/support'}))
  ]});
}
