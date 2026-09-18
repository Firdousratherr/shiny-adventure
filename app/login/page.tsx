'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function CustomerLogin() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [show,setShow]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{const r=await signIn('credentials',{email:email.trim(),password,role:'customer',redirect:false,callbackUrl:'/account'});if(r?.error){setError('Invalid email or password.');setLoading(false);return;}window.location.href=r?.url||'/account';}catch{setError('Unable to sign in right now. Please try again.');setLoading(false);}}
  return <main className="relative min-h-screen overflow-hidden bg-[#070b16] px-4 py-6 text-white sm:px-6 sm:py-10">
    <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl"/><div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl"/>
    <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1222] shadow-[0_30px_100px_rgba(0,0,0,.5)] md:grid-cols-2">
      <section className="hidden min-h-[680px] flex-col justify-between bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950 p-10 lg:p-14 md:flex">
        <Link href="/" className="text-2xl font-black">🛍️ Zenvora<span className="text-violet-200">.</span></Link>
        <div className="max-w-md"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-indigo-100">Premium products · Better living</span><h1 className="mt-6 text-5xl font-black leading-tight">Shop smart.<br/><span className="text-fuchsia-200">Live better.</span></h1><p className="mt-5 leading-7 text-indigo-100">Sign in to keep your orders, wishlist and shopping experience connected across devices.</p><div className="mt-8 grid grid-cols-3 gap-3">{['Fast delivery','Secure payments','Easy returns'].map(x=><div key={x} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center text-xs font-bold">{x}</div>)}</div></div>
        <p className="text-xs text-indigo-200">Zenvora · Shopping made simple</p>
      </section>
      <section className="flex min-h-[680px] items-center bg-[#0c1222] p-6 sm:p-10 lg:p-14"><div className="w-full max-w-md mx-auto">
        <div className="mb-8 flex items-center justify-between md:hidden"><Link href="/" className="text-xl font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link><span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-200">Customer</span></div>
        <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white">← Back to store</Link>
        <p className="mt-8 text-sm font-black uppercase tracking-[.2em] text-fuchsia-400">Welcome back</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Sign in</h1><p className="mt-3 text-sm leading-6 text-slate-400">Access your orders, wishlist and account.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-bold text-slate-200">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/></label>
          <label className="block text-sm font-bold text-slate-200">Password<div className="relative mt-2"><input required type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 pr-20 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10">{show?'Hide':'Show'}</button></div></label>
          <div className="-mt-2 text-right"><Link href="/forgot-password" className="text-sm font-bold text-fuchsia-400 hover:text-fuchsia-300">Forgot password?</Link></div>
          {error&&<div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
          <button disabled={loading} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 disabled:opacity-60">{loading?'Signing in…':'Sign In →'}</button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-400">Don&apos;t have an account? <Link href="/signup" className="font-bold text-fuchsia-400 hover:text-fuchsia-300">Create one</Link></p>
        <Link href="/admin/login" className="mt-6 block text-center text-xs text-slate-600 hover:text-slate-400">Administrator login</Link>
      </div></section>
    </div>
  </main>;
}
