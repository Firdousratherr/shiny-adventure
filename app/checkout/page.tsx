'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../components/cart-provider';

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
          const preferred = list.find(a => a.isDefault) || list[0];
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
        // Guests simply continue with the normal checkout form.
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
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
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
      router.push(`/payment/${encodeURIComponent(data.orderNumber)}?token=${encodeURIComponent(data.paymentToken)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create order.');
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) return (
    <main className="min-h-screen bg-[#070b16] px-4 py-16 text-center text-white">
      <h1 className="text-2xl font-black">Your cart is empty</h1>
      <Link href="/products" className="mt-5 inline-block rounded-xl bg-slate-900 px-6 py-3 font-black text-slate-950">Shop products</Link>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#070b16] px-0 py-5 text-white sm:py-8">
      <Link href="/cart" className="font-semibold">← Back to cart</Link>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <form ref={formRef} onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-violet-600">Secure checkout</p>
              <h1 className="text-2xl font-black sm:text-3xl">Delivery details</h1>
            </div>
            {loadingAccount && <span className="text-xs text-slate-400">Checking saved details…</span>}
          </div>

          {addresses.length > 0 && (
            <section className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white">Saved addresses</h2>
                  <p className="text-xs text-slate-400">Choose an address to fill the form automatically.</p>
                </div>
                <Link href="/account/addresses" className="text-xs font-bold text-violet-700">Manage</Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {addresses.map(address => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => applyAddress(address)}
                    className={`text-left rounded-xl border border-white/10 bg-white/5 p-3 transition ${selectedAddress === address.id ? 'border-violet-400 bg-white/10 ring-2 ring-violet-500/20' : 'border-white/10 bg-white/5 hover:border-violet-400/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{address.label}</span>
                      {address.isDefault && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">DEFAULT</span>}
                    </div>
                    <p className="mt-1 text-sm font-semibold">{address.fullName}</p>
                    <p className="text-xs text-slate-400">{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}</p>
                    <p className="text-xs text-slate-500">{address.city}, {address.district}, {address.state} - {address.pinCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{address.phone}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-semibold">Full name<input name="customerName" required minLength={2} maxLength={100} className="mt-1.5 h-11 w-full rounded-xl border border-white/10 px-3 text-sm"/></label>
            <label className="text-sm font-semibold">Mobile number<input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} className="mt-2 w-full rounded-xl border p-3" placeholder="10-digit mobile"/></label>
            <label className="text-sm font-semibold">Email (optional)<input name="email" type="email" className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="sm:col-span-2 text-sm font-semibold">Address<input name="addressLine1" required minLength={5} maxLength={200} className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="text-sm font-semibold">Apartment / area<input name="addressLine2" maxLength={200} className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="text-sm font-semibold">Landmark<input name="landmark" maxLength={120} className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="text-sm font-semibold">City<input name="city" required className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="text-sm font-semibold">District<input name="district" required className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="text-sm font-semibold">State<input name="state" required className="mt-2 w-full rounded-xl border p-3"/></label>
            <label className="text-sm font-semibold">PIN code<input name="pinCode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="mt-2 w-full rounded-xl border p-3"/></label>
          </div>

          {error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="mt-5 w-full rounded-xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-black/20 disabled:opacity-50">
            {loading ? 'Creating order…' : 'Continue to payment'}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20 lg:sticky lg:top-20">
          <h2 className="font-bold">Order summary</h2>
          {items.map(i => <div key={i.productId} className="mt-3 flex justify-between gap-3 text-sm"><span>{i.name} × {i.quantity}</span><span>₹{(i.price*i.quantity).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>)}
          <div className="mt-5 flex justify-between border-t border-white/10 pt-4"><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></div>
          <p className="mt-2 text-xs text-slate-500">Final delivery and total are calculated again on the server.</p>
        </aside>
      </div>
    </main>
  );
}
