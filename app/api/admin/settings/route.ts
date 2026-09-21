import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../lib/admin-audit';

const text=(v:unknown,max=300)=>typeof v==='string'?v.trim().slice(0,max):'';
const money=(v:unknown)=>{const s=text(v,30);if(!/^\d+(\.\d{1,2})?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)&&n>=0?s:null};
const phone=(v:unknown)=>{const s=text(v,20);return !s||/^[0-9+()\-\s]{7,20}$/.test(s)?s:null};

export async function POST(request:Request){
 const admin=await requireAdminPermission('settings');if(!admin)return NextResponse.json({error:'Settings permission required.'},{status:403});
 try{const b=await request.json();const storeName=text(b.storeName,100),storeDescription=text(b.storeDescription,300),upiId=text(b.upiId,100),upiDisplayName=text(b.upiDisplayName,100),freeShippingThreshold=money(b.freeShippingThreshold),flatDeliveryCharge=money(b.flatDeliveryCharge),supportEmail=text(b.supportEmail,160),supportPhone=phone(b.supportPhone),whatsappNumber=phone(b.whatsappNumber),razorpayKeyId=text(b.razorpayKeyId,100),razorpayEnabled=b.razorpayEnabled===true;
  if(!storeName)return NextResponse.json({error:'Store name is required.'},{status:400});
  if(freeShippingThreshold===null||flatDeliveryCharge===null)return NextResponse.json({error:'Shipping values must be valid non-negative amounts.'},{status:400});
  if(supportPhone===null||whatsappNumber===null)return NextResponse.json({error:'Invalid support phone or WhatsApp number.'},{status:400});
  if(supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))return NextResponse.json({error:'Invalid support email.'},{status:400});
  if(razorpayEnabled&&!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(razorpayKeyId))return NextResponse.json({error:'A valid Razorpay Key ID is required when Razorpay is enabled.'},{status:400});
  const values={storeName,storeDescription,upiId,upiDisplayName,freeShippingThreshold,flatDeliveryCharge,supportEmail:supportEmail||'',supportPhone:supportPhone||'',whatsappNumber:whatsappNumber||'',razorpayEnabled:razorpayEnabled?'true':'false',razorpayKeyId};
  await db.$transaction(Object.entries(values).map(([key,value])=>db.settings.upsert({where:{key},update:{value},create:{key,value}})));
  await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'SETTINGS_UPDATED', entityType: 'SETTINGS', details: { keys: Object.keys(values) } });
  return NextResponse.json({ok:true});
 }catch(error){console.error('settings update failed',error);return NextResponse.json({error:'Unable to save settings.'},{status:500})}
}
