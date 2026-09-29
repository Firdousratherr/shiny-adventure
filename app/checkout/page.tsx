'use client';

import { FormEvent,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StoreHeader from '../../components/store-header';
import StoreFooter from '../../components/store-footer';
import { useCart } from '../../components/cart-provider';

type Address={id:string;label:string;fullName:string;phone:string;addressLine1:string;addressLine2?:string|null;landmark?:string|null;city:string;district:string;state:string;pinCode:string;isDefault:boolean};
type Profile={name:string;email:string};

export default function Checkout(){
  const {items,subtotal,clear}=useCart();
  const router=useRouter();
  const formRef=useRef<HTMLFormElement>(null);
  const [loading,setLoading]=useState(false);
  const [loadingAccount,setLoadingAccount]=useState(true);
  const [error,setError]=useState('');
  const [addresses,setAddresses]=useState<Address[]>([]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [selectedAddress,setSelectedAddress]=useState('');
  const [coupon,setCoupon]=useState('');

  useEffect(()=>{
    let active=true;
    async function loadAccount(){
      try{
        const [addressRes,profileRes]=await Promise.all([fetch('/api/account/addresses',{cache:'no-store'}),fetch('/api/account/profile',{cache:'no-store'})]);
        if(!active)return;
        if(addressRes.ok){
          const data=await addressRes.json();
          const list=Array.isArray(data.addresses)?data.addresses as Address[]:[];
          setAddresses(list);
          const preferred=list.find(a=>a.isDefault)||list[0];
          if(preferred){setSelectedAddress(preferred.id);setTimeout(()=>applyAddress(preferred),0);}
        }
        if(profileRes.ok){const data=await profileRes.json();if(data?.name||data?.email)setProfile({name:data.name||'',email:data.email||''});}
      }catch{}finally{if(active)setLoadingAccount(false);}
    }
    loadAccount();
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(!formRef.current||!profile||addresses.length)return;
    const form=formRef.current;
    const name=form.elements.namedItem('customerName') as HTMLInputElement|null;
    const email=form.elements.namedItem('email') as HTMLInputElement|null;
    if(name&&!name.value)name.value=profile.name;
    if(email&&!email.value)email.value=profile.email;
  },[profile,addresses.length]);

  function setField(name:string,value:string){
    const field=formRef.current?.elements.namedItem(name) as HTMLInputElement|null;
    if(field)field.value=value;
  }
  function applyAddress(address:Address){
    setSelectedAddress(address.id);
    setField('customerName',address.fullName);setField('phone',address.phone);setField('addressLine1',address.addressLine1);
    setField('addressLine2',address.addressLine2||'');setField('landmark',address.landmark||'');setField('city',address.city);
    setField('district',address.district);setField('state',address.state);setField('pinCode',address.pinCode);if(profile)setField('email',profile.email);setError('');
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setLoading(true);setError('');
    const form=new FormData(e.currentTarget);
    const body={
      customerName:String(form.get('customerName')||''),email:String(form.get('email')||''),phone:String(form.get('phone')||''),
      addressLine1:String(form.get('addressLine1')||''),addressLine2:String(form.get('addressLine2')||''),landmark:String(form.get('landmark')||''),
      city:String(form.get('city')||''),district:String(form.get('district')||''),state:String(form.get('state')||''),pinCode:String(form.get('pinCode')||''),
      couponCode:coupon.trim().toUpperCase(),items:items.map(i=>({productId:i.productId,quantity:i.quantity}))
    };
    try{
      const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Checkout failed');
      clear();router.push('/payment/'+encodeURIComponent(data.orderNumber)+'?token='+encodeURIComponent(data.paymentToken));
    }catch(err){setError(err instanceof Error?err.message:'Unable to create order.')}finally{setLoading(false);}
  }

  if(!items.length)return <main className="store-shell min-h-screen"><StoreHeader /><div className="store-container py-16"><div className="store-empty mx-auto max-w-lg"><div className="store-empty-icon">🛒</div><h1>Your cart is empty</h1><p>Add a product before starting checkout.</p><Link href="/products" className="store-primary-btn mt-5">Shop products <span>→</span></Link></div></div><StoreFooter /></main>;

  return (
    <main id="main-content" className="store-shell min-h-screen">
      <StoreHeader />
      <div className="store-container pb-12 pt-7 sm:pt-10">
        <div className="store-page-heading">
          <div><p className="store-kicker">Checkout</p><h1 className="store-page-title">Complete your order</h1><p className="mt-2 text-sm text-slate-500">A simple two-step checkout designed to keep the important details clear.</p></div>
          <span className="store-secure-pill">🔒 Secure checkout</span>
        </div>

        <div className="store-checkout-progress mt-7">
          <div className="is-active"><span>1</span><div><strong>Delivery</strong><small>Address & contact</small></div></div>
          <div className="store-progress-line" /><div><span>2</span><div><strong>Payment</strong><small>Secure payment</small></div></div>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_370px]">
          <form ref={formRef} onSubmit={submit} className="store-panel">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-5">
              <div><p className="store-kicker">Step 1 of 2</p><h2 className="mt-1 text-2xl font-black text-slate-950">Delivery details</h2></div>
              {loadingAccount&&<span className="text-xs font-semibold text-slate-400">Checking saved details…</span>}
            </div>

            {addresses.length>0&&<section className="mt-6 rounded-3xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900">Saved addresses</h3><p className="mt-1 text-xs text-slate-500">Choose one to fill the form automatically.</p></div><Link href="/account/addresses" className="text-xs font-extrabold text-violet-700">Manage →</Link></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{addresses.map(address=><button key={address.id} type="button" onClick={()=>applyAddress(address)} className={'store-address-card '+(selectedAddress===address.id?'is-active':'')}><div className="flex items-center justify-between gap-2"><span className="font-black">{address.label}</span>{address.isDefault&&<span className="store-default-badge">DEFAULT</span>}</div><p className="mt-1 text-sm font-extrabold">{address.fullName}</p><p className="text-xs text-slate-500">{address.addressLine1}{address.addressLine2?', '+address.addressLine2:''}</p><p className="text-xs text-slate-400">{address.city}, {address.district}, {address.state} - {address.pinCode}</p><p className="mt-1 text-xs text-slate-500">{address.phone}</p></button>)}</div>
            </section>}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="store-field-label sm:col-span-2">Full name<input name="customerName" required minLength={2} maxLength={100}/></label>
              <label className="store-field-label">Mobile number<input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile"/></label>
              <label className="store-field-label">Email (optional)<input name="email" type="email"/></label>
              <label className="store-field-label sm:col-span-2">Address<input name="addressLine1" required minLength={5} maxLength={200}/></label>
              <label className="store-field-label">Apartment / area<input name="addressLine2" maxLength={200}/></label>
              <label className="store-field-label">Landmark<input name="landmark" maxLength={120}/></label>
              <label className="store-field-label">City<input name="city" required/></label>
              <label className="store-field-label">District<input name="district" required/></label>
              <label className="store-field-label">State<input name="state" required/></label>
              <label className="store-field-label">PIN code<input name="pinCode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}/></label>
            </div>

            {error&&<p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
            <button disabled={loading} className="store-primary-btn mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{loading?'Creating secure order…':'Continue to payment'}<span>→</span></button>
          </form>

          <aside className="store-summary-card h-fit lg:sticky lg:top-24">
            <p className="store-kicker">Step 2</p><h2 className="mt-1 text-2xl font-black text-slate-950">Order summary</h2>
            <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">{items.map(i=><div key={i.productId} className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-600">{i.name} × {i.quantity}</span><span className="shrink-0 font-extrabold text-slate-900">₹{(i.price*i.quantity).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>)}</div>
            <div className="mt-5 border-t border-slate-200 pt-5"><label className="store-field-label">Coupon code<input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Optional" className="uppercase placeholder:normal-case"/></label></div>
            <div className="mt-5 flex justify-between border-t border-slate-200 pt-5"><span className="font-bold text-slate-500">Subtotal</span><strong className="text-lg text-slate-950">₹{subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Final delivery charges and order total are calculated again on the server before payment.</div>
          </aside>
        </div>
      </div>
      <StoreFooter />
    </main>
  );
}
