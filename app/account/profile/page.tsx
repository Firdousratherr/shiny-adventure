'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Profile={name:string;email:string};

export default function ProfilePage(){
  const [profile,setProfile]=useState<Profile|null>(null); const [name,setName]=useState(''); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  useEffect(()=>{fetch('/api/account/profile').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load profile.');setProfile(d.user);setName(d.user.name);}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  async function save(e:FormEvent){e.preventDefault();setError('');setMessage('');setSaving(true);try{const r=await fetch('/api/account/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to update profile.');setProfile(d.user);setName(d.user.name);setMessage('Profile updated successfully.')}catch(e){setError(e instanceof Error?e.message:'Unable to update profile.')}finally{setSaving(false)}}
  return <main className="min-h-screen bg-[#f7f8fc] text-slate-900"><header className="border-b border-slate-200 bg-white/90 backdrop-blur"><div className="container flex h-16 items-center justify-between"><Link href="/" className="brand-mark text-2xl font-black">Zenvora<span className="text-fuchsia-500">.</span></Link><Link href="/account" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:border-violet-300 hover:text-violet-700">← My account</Link></div></header>
  <div className="container max-w-3xl py-8 sm:py-12"><p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-600">Account settings</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Edit profile</h1><p className="mt-3 text-sm text-slate-500">Keep your customer profile information up to date.</p>
  <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-violet-950/5 sm:p-8">{loading?<p className="text-slate-500">Loading profile…</p>:<form onSubmit={save} className="space-y-5">
    <label className="block text-xs font-black text-slate-700">Full name<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"/></label>
    <label className="block text-xs font-black text-slate-700">Email address<input value={profile?.email||''} readOnly className="mt-2 h-13 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-400 outline-none"/></label>
    <p className="text-xs leading-5 text-slate-400">Your email is your login identifier and cannot be changed from this profile screen.</p>
    {error&&<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</div>}
    {message&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{message}</div>}
    <button disabled={saving} className="h-13 w-full rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-fuchsia-500 font-black text-white shadow-lg shadow-violet-500/20 disabled:opacity-60">{saving?'Saving…':'Save profile →'}</button>
  </form>}</section></div></main>;
}
