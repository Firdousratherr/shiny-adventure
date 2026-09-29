'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../components/cart-provider';
import StoreHeader from '../../components/store-header';

type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  district: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
};

type Profile = { name: string; email: string };

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [coupon, setCoupon] = useState('');

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      try {
        const [addressRes, profileRes] = await Promise.all([
          fetch('/api/account/addresses', { cache: 'no-store' }),
          fetch('/api/account/profile', { cache: 'no-store' }),
        ]);
        if (!active) return;
        if (addressRes.ok) {
          const data = await addressRes.json();
          const list = Array.isArray(data.addresses) ? data.addresses as Address[] : [];
          setAddresses(list);
          const preferred = list.find((a) => a.isDefault) || list[0];
          if (preferred) {
            setSelectedAddress(preferred.id);
            setTimeout(() => applyAddress(preferred), 0);
          }
        }
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data?.name || data?.email) setProfile({ name: data.name || '', email: data.email || '' });
        }
      } catch {
        // Guests continue with manual checkout details.
      } finally {
        if (active) setLoadingAccount(false);
      }
    }
    loadAccount();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!formRef.current || !profile || addresses.length) return;
    const form = formRef.current;
    const name = form.elements.namedItem('customerName') as HTMLInputElement | null;
    const email = form.elements.namedItem('email') as HTMLInputElement | null;
    if (name && !name.value) name.value = profile.name;
    if (email && !email.value) email.value = profile.email;
  }, [profile, addresses.length]);

  function setField(name: string, value: string) {
    const field = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    if (field) field.value = value;
  }

  function applyAddress(address: Address) {
    setSelectedAddress(address.id);
    setField('customerName', address.fullName);
    setField('phone', address.phone);
    setField('addressLine1', address.addressLine1);
    setField('addressLine2', address.addressLine2 || '');
    setField('landmark', address.landmark || '');
    setField('city', address.city);
    setField('district', address.district);
    setField('state', address.state);
    setField('pinCode', address.pinCode);
    if (profile) setField('email', profile.email);
    setError('');
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const body = {
      customerName: String(form.get('customerName') || ''),
      email: String(form.get('email') || ''),
      phone: String(form.get('phone') || ''),
      addressLine1: String(form.get('addressLine1') || ''),
      addressLine2: String(form.get('addressLine2') || ''),
      landmark: String(form.get('landmark') || ''),
      city: String(form.get('city') || ''),
      district: String(form.get('district') || ''),
      state: String(form.get('state') || ''),
      pinCode: String(form.get('pinCode') || ''),
      couponCode: coupon.trim().toUpperCase(),
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    };
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Checkout failed');
      clear();
      router.push('/payment/' + encodeURIComponent(data.orderNumber) + '?token=' + encodeURIComponent(data.paymentToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create order.');
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <main className="store-dark min-h-screen bg-[#070b16] pb-28 text-white">
        <StoreHeader />
        <div className="container py-16">
          <div className="zenvora-empty-state mx-auto max-w-lg">
            <div className="text-5xl">🛒</div>
            <h1 className="mt-5 text-2xl font-black">Your cart is empty</h1>
            <p className="mt-2 text-sm text-slate-500">Add a product before starting checkout.</p>
            <Link href="/products" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-black text-slate-950">Shop products</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="store-dark min-h-screen bg-[#070b16] pb-28 text-white sm:pb-10">
      <StoreHeader />
      <div className="container py-5 sm:py-8">
        <div className="zenvora-checkout-steps">
          <span className="is-active"><b>1</b> Delivery</span>
          <i />
          <span><b>2</b> Payment</span>
          <div className="ml-auto hidden text-xs text-emerald-300 sm:block">🔒 Secure checkout</div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <form ref={formRef} onSubmit={submit} className="zenvora-checkout-panel">
            <div className="border-b border-white/10 pb-5">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-400">Step 1 of 2 · Delivery</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.03em]">Where should we deliver?</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Choose a saved address or enter the delivery details below.</p>
            </div>

            {addresses.length > 0 ? (
              <section className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black">Saved addresses</h2>
                    <p className="mt-1 text-xs text-slate-500">Pick one to fill the form automatically.</p>
                  </div>
                  <Link href="/account/addresses" className="text-xs font-bold text-violet-300 hover:text-white">Manage</Link>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => applyAddress(address)}
                      className={'rounded-2xl border p-4 text-left transition ' + (selectedAddress === address.id ? 'border-violet-400/70 bg-violet-500/[.08] ring-2 ring-violet-500/10' : 'border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.05]')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black">{address.label}</span>
                        {address.isDefault ? <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-black text-violet-200">DEFAULT</span> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{address.fullName}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{address.addressLine1}{address.addressLine2 ? ', ' + address.addressLine2 : ''}</p>
                      <p className="text-xs text-slate-500">{address.city}, {address.district}, {address.state} - {address.pinCode}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="zenvora-field sm:col-span-2">Full name<input name="customerName" required minLength={2} maxLength={100} /></label>
              <label className="zenvora-field">Mobile number<input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile" /></label>
              <label className="zenvora-field">Email (optional)<input name="email" type="email" /></label>
              <label className="zenvora-field sm:col-span-2">Address<input name="addressLine1" required minLength={5} maxLength={200} /></label>
              <label className="zenvora-field">Apartment / area<input name="addressLine2" maxLength={200} /></label>
              <label className="zenvora-field">Landmark<input name="landmark" maxLength={120} /></label>
              <label className="zenvora-field">City<input name="city" required /></label>
              <label className="zenvora-field">District<input name="district" required /></label>
              <label className="zenvora-field">State<input name="state" required /></label>
              <label className="zenvora-field">PIN code<input name="pinCode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} /></label>
            </div>

            {error ? <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
            <button disabled={loading} className="zenvora-primary-btn mt-6 min-h-12 w-full rounded-xl px-5 py-3.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Creating order…' : 'Continue to payment →'}
            </button>
          </form>

          <aside className="zenvora-order-summary h-fit lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-400">Order review</p>
                <h2 className="mt-1 text-xl font-black">Your order</h2>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-400">{items.length} line{items.length === 1 ? '' : 's'}</span>
            </div>

            <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate text-slate-300">{item.name} × {item.quantity}</span>
                  <span className="shrink-0 font-bold">₹{(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <label className="zenvora-field">Coupon code<input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Optional" className="uppercase placeholder:normal-case" /></label>
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex justify-between gap-4 text-slate-400"><span>Subtotal</span><strong className="text-white">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Delivery, coupon and final total are recalculated securely when the order is created.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
