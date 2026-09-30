'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function Login() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [showPassword,setShowPassword]=useState(false);

  async function submit(e:FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r=await signIn('credentials',{email:email.trim(),password,role:'admin',redirect:false,callbackUrl:'/admin/dashboard'});
      if(r?.error){setError('Invalid email or password. Make sure these exactly match the admin account created in the production database.');setLoading(false);return;}
      window.location.href=r?.url||'/admin/dashboard';
    } catch { setError('Unable to sign in right now. Please check the deployment and authentication configuration.'); setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-3 py-4 sm:px-5 sm:py-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-violet-950/10 sm:min-h-[calc(100vh-3.5rem)] md:grid-cols-[1.1fr_.9fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#171047] via-[#4b2ab7] to-[#8b3fe5] p-9 text-white md:flex md:flex-col md:justify-between lg:p-12">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute bottom-[-90px] left-[35%] h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />
          <Link href="/" className="relative brand-lockup text-3xl font-black tracking-tight"><span className="z-logo-badge" aria-hidden="true">Z</span><span>Zenvora<span className="text-cyan-200">.</span></span></Link>
          <div className="relative max-w-lg">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-100">Admin workspace</span>
            <h1 className="mt-5 text-5xl font-black leading-[.98] tracking-[-.045em] lg:text-6xl">Your store.<br /><span className="text-cyan-200">Your control.</span></h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-violet-100/80">Manage products, orders, customers and growth tools from one organized workspace.</p>
            <div className="mt-7 grid grid-cols-3 gap-2">
              {['Products','Orders','Insights'].map(item=><div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center text-[10px] font-black">{item}</div>)}
            </div>
          </div>
          <p className="relative text-[10px] text-violet-200/70">Protected administrator access</p>
        </section>

        <section className="flex items-center px-5 py-8 sm:px-9 lg:px-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex items-center justify-between md:hidden"><Link href="/" className="brand-lockup text-2xl font-black"><span className="z-logo-badge" aria-hidden="true">Z</span><span>Zenvora<span className="text-fuchsia-500">.</span></span></Link><span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-700">Admin</span></div>
            <Link href="/" className="text-xs font-bold text-slate-400 hover:text-violet-700">← Back to store</Link>
            <p className="mt-7 text-[10px] font-black uppercase tracking-[.2em] text-violet-600">Administrator access</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-.04em] text-slate-950 sm:text-5xl">Sign in</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Use your administrator credentials to open the command center.</p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-xs font-black text-slate-700">Email address<input required autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" placeholder="admin@example.com"/></label>
              <label className="block text-xs font-black text-slate-700">Password<div className="relative mt-2"><input required autoComplete="current-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-20 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" placeholder="Enter your password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-[10px] font-black text-slate-400 hover:bg-violet-50 hover:text-violet-700">{showPassword?'Hide':'Show'}</button></div></label>
              {error&&<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-700">{error}</div>}
              <button disabled={loading} className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-fuchsia-500 font-black text-white shadow-lg shadow-violet-500/20 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{loading?'Signing you in…':'Continue to dashboard'}{!loading&&<span className="transition group-hover:translate-x-1">→</span>}</button>
            </form>
            <p className="mt-6 text-center text-[10px] leading-5 text-slate-400">Administrator access only. Authentication and permissions are enforced server-side.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
