import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';

async function customer() {
  const s=await auth();
  if(s?.user?.role!=='customer'||!s.user.email)return null;
  return db.customerUser.findUnique({where:{email:s.user.email}});
}
function fields(b:any){
  const phone=String(b.phone||'').replace(/\D/g,'');
  const pin=String(b.pinCode||'').replace(/\D/g,'');
  return {label:String(b.label||'Home').trim().slice(0,30)||'Home',fullName:String(b.fullName||'').trim().slice(0,100),phone,addressLine1:String(b.addressLine1||'').trim().slice(0,200),addressLine2:String(b.addressLine2||'').trim().slice(0,200)||null,landmark:String(b.landmark||'').trim().slice(0,120)||null,city:String(b.city||'').trim().slice(0,80),district:String(b.district||'').trim().slice(0,80),state:String(b.state||'').trim().slice(0,80),pinCode:pin,isDefault:Boolean(b.isDefault)};
}
function validate(a:any){
  if(['fullName','phone','addressLine1','city','district','state','pinCode'].some(k=>!a[k]))return 'Please complete all required address fields.';
  if(!/^[6-9]\d{9}$/.test(a.phone))return 'Enter a valid 10-digit mobile number.';
  if(!/^\d{6}$/.test(a.pinCode))return 'Enter a valid 6-digit PIN code.';
  return null;
}
export async function GET(){
  const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json({addresses:await db.customerAddress.findMany({where:{customerId:c.id},orderBy:[{isDefault:'desc'},{createdAt:'desc'}]})});
}
export async function POST(request:Request){
  try{
    const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
    const a=fields(await request.json()); const error=validate(a); if(error)return NextResponse.json({error},{status:400});
    const count=await db.customerAddress.count({where:{customerId:c.id}}); a.isDefault=a.isDefault||count===0;
    const address=await db.$transaction(async tx=>{if(a.isDefault)await tx.customerAddress.updateMany({where:{customerId:c.id},data:{isDefault:false}});return tx.customerAddress.create({data:{...a,customerId:c.id}});});
    return NextResponse.json({ok:true,address},{status:201});
  }catch(e){console.error('address create failed',e);return NextResponse.json({error:'Unable to save address.'},{status:500});}
}
export async function PATCH(request:Request){
  try{
    const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
    const b=await request.json(); const id=String(b.id||''); if(!id)return NextResponse.json({error:'Address ID is required.'},{status:400});
    const existing=await db.customerAddress.findFirst({where:{id,customerId:c.id}}); if(!existing)return NextResponse.json({error:'Address not found.'},{status:404});
    const a=fields(b); const error=validate(a); if(error)return NextResponse.json({error},{status:400});
    const address=await db.$transaction(async tx=>{if(a.isDefault)await tx.customerAddress.updateMany({where:{customerId:c.id},data:{isDefault:false}});return tx.customerAddress.update({where:{id},data:a});});
    return NextResponse.json({ok:true,address});
  }catch(e){console.error('address update failed',e);return NextResponse.json({error:'Unable to update address.'},{status:500});}
}
export async function DELETE(request:Request){
  try{
    const c=await customer(); if(!c)return NextResponse.json({error:'Unauthorized'},{status:401});
    const id=String((await request.json()).id||''); const existing=await db.customerAddress.findFirst({where:{id,customerId:c.id}});
    if(!existing)return NextResponse.json({error:'Address not found.'},{status:404});
    await db.customerAddress.delete({where:{id}});
    if(existing.isDefault){const next=await db.customerAddress.findFirst({where:{customerId:c.id},orderBy:{createdAt:'desc'}});if(next)await db.customerAddress.update({where:{id:next.id},data:{isDefault:true}});}
    return NextResponse.json({ok:true});
  }catch(e){console.error('address delete failed',e);return NextResponse.json({error:'Unable to delete address.'},{status:500});}
}
