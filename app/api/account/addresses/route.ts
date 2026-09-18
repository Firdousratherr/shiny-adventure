import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';

async function customer() {
  const s=await auth();
  if(s?.user?.role!=='customer'||!s.user.email)return null;
  return db.customerUser.findUnique({where:{email:s.user.email}});
}
export async function GET(){
  const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
  const addresses=await db.customerAddress.findMany({where:{customerId:c.id},orderBy:[{isDefault:'desc'},{createdAt:'desc'}]});
  return NextResponse.json({addresses});
}
export async function POST(request:Request){
  try{
    const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
    const b=await request.json();
    const required=['fullName','phone','addressLine1','city','district','state','pinCode'];
    if(required.some(k=>!String(b?.[k]||'').trim()))return NextResponse.json({error:'Please complete all required address fields.'},{status:400});
    const phone=String(b.phone).replace(/\D/g,''); const pin=String(b.pinCode).replace(/\D/g,'');
    if(!/^[6-9]\d{9}$/.test(phone))return NextResponse.json({error:'Enter a valid 10-digit mobile number.'},{status:400});
    if(!/^\d{6}$/.test(pin))return NextResponse.json({error:'Enter a valid 6-digit PIN code.'},{status:400});
    const count=await db.customerAddress.count({where:{customerId:c.id}});
    const isDefault=Boolean(b.isDefault)||count===0;
    const address=await db.$transaction(async tx=>{
      if(isDefault)await tx.customerAddress.updateMany({where:{customerId:c.id},data:{isDefault:false}});
      return tx.customerAddress.create({data:{customerId:c.id,label:String(b.label||'Home').trim().slice(0,30)||'Home',fullName:String(b.fullName).trim().slice(0,100),phone,addressLine1:String(b.addressLine1).trim().slice(0,200),addressLine2:String(b.addressLine2||'').trim().slice(0,200)||null,landmark:String(b.landmark||'').trim().slice(0,120)||null,city:String(b.city).trim().slice(0,80),district:String(b.district).trim().slice(0,80),state:String(b.state).trim().slice(0,80),pinCode:pin,isDefault}});
    });
    return NextResponse.json({ok:true,address},{status:201});
  }catch(e){console.error('address create failed',e);return NextResponse.json({error:'Unable to save address.'},{status:500});}
}
export async function PATCH(request:Request){
  try{
    const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
    const b=await request.json(); const id=String(b?.id||''); if(!id)return NextResponse.json({error:'Address ID is required.'},{status:400});
    const existing=await db.customerAddress.findFirst({where:{id,customerId:c.id}}); if(!existing)return NextResponse.json({error:'Address not found.'},{status:404});
    if(b.isDefault){await db.$transaction([db.customerAddress.updateMany({where:{customerId:c.id},data:{isDefault:false}}),db.customerAddress.update({where:{id},data:{isDefault:true}})]);return NextResponse.json({ok:true});}
    return NextResponse.json({error:'Only default-address changes are supported here.'},{status:400});
  }catch(e){console.error('address update failed',e);return NextResponse.json({error:'Unable to update address.'},{status:500});}
}
export async function DELETE(request:Request){
  try{
    const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
    const id=String((await request.json())?.id||''); const existing=await db.customerAddress.findFirst({where:{id,customerId:c.id}});
    if(!existing)return NextResponse.json({error:'Address not found.'},{status:404});
    await db.customerAddress.delete({where:{id}});
    if(existing.isDefault){const next=await db.customerAddress.findFirst({where:{customerId:c.id},orderBy:{createdAt:'desc'}});if(next)await db.customerAddress.update({where:{id:next.id},data:{isDefault:true}});}
    return NextResponse.json({ok:true});
  }catch(e){console.error('address delete failed',e);return NextResponse.json({error:'Unable to delete address.'},{status:500});}
}
