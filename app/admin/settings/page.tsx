import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import AdminNav from '../../../components/admin-nav';
import StoreSettings from './store-settings';

const keys=['storeName','storeDescription','upiId','upiDisplayName','freeShippingThreshold','flatDeliveryCharge','supportEmail','supportPhone','whatsappNumber','razorpayEnabled','razorpayKeyId'];

export default async function SettingsPage(){
  const session=await auth(); if(session?.user?.role!=='admin') redirect('/admin/login');
  const rows=await db.settings.findMany({where:{key:{in:keys}}});
  const v=Object.fromEntries(rows.map(x=>[x.key,x.value]));
  return <main className="min-h-screen bg-slate-100"><AdminNav active="settings"/><div className="container py-8 md:py-10"><p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Configuration</p><h1 className="mt-1 text-3xl font-black tracking-tight">Store settings</h1><p className="mt-2 text-slate-500">Manage storefront, shipping, UPI and online payment settings.</p><StoreSettings initial={{storeName:v.storeName||'Zenvora',storeDescription:v.storeDescription||'',upiId:v.upiId||'',upiDisplayName:v.upiDisplayName||'Zenvora',freeShippingThreshold:v.freeShippingThreshold||'999',flatDeliveryCharge:v.flatDeliveryCharge||'79',supportEmail:v.supportEmail||'',supportPhone:v.supportPhone||'',whatsappNumber:v.whatsappNumber||''}} razorpayEnabled={v.razorpayEnabled==='true'} razorpayKeyId={v.razorpayKeyId||''}/></div></main>;
}