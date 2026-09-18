'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Profile = { name:string; email:string };

export default function ProfilePage() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [name,setName]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{
    fetch('/api/account/profile').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load profile.');setProfile(d.user);setName(d.user.name);}).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[]);

  async function save(e:FormEvent){
    e.preventDefault();setError('');setMessage('');setSaving(true);
    try{
      const r=await fetch('/api/account/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to update profile.');
      setProfile(d.user);setName(d.user.name);setMessage('Profile updated successfully.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to update profile.');}finally{setSaving(false);}
  }

  return <main className="min-h-screen bg-[#070b16] text-white">
    <header className="border-b border-white/10 bg-[#090e1c]/90 backdrop-blur"><div className="container flex h-16 items-center justify-between"><Link href="/" className="text-2xl font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link><Link href="/account" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5">← My account</Link></div></header>
    <div className="container max-w-3xl py-8 sm:py-12">
      <p className="text-xs font-black uppercase tracking-[.2em] text-fuchsia-400">Account settings</p><h1 className="mt-2 text-4xl font-black">Edit profile</h1><p className="mt-3 text-sm text-slate-400">Keep your customer profile information up to date.</p>
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
        {loading?<p className="text-slate-400">Loading profile…</p>:<form onSubmit={save} className="space-y-6">
          <label className="block text-sm font-bold text-slate-200">Full name<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-violet-500"/></label>
          <label className="block text-sm font-bold text-slate-200">Email address<input value={profile?.email||''} readOnly className="mt-2 h-14 w-full cursor-not-allowed rounded-2xl border border-white/10 bg-black/20 px-4 text-slate-500 outline-none"/></label>
          <p className="text-xs leading-5 text-slate-500">Your email is your login identifier and cannot be changed from this profile screen.</p>
          {error&&<div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
          {message&&<div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}
          <button disabled={saving} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black disabled:opacity-60">{saving?'Saving…':'Save profile'}</button>
        </form>}
      </section>
    </div>
  </main>;
}
