'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function Signup() {
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState('');
  const [otp,setOtp]=useState(''); const [step,setStep]=useState<'details'|'otp'>('details'); const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [resending,setResending]=useState(false); const [show,setShow]=useState(false); const [cooldown,setCooldown]=useState(0);

  function startCooldown() {
    setCooldown(60);
    const timer=setInterval(()=>setCooldown(v=>{if(v<=1){clearInterval(timer);return 0;}return v-1;}),1000);
  }

  async function requestOtp(e:FormEvent) {
    e.preventDefault(); setError('');
    if(password!==confirm){setError('Passwords do not match.');return;}
    setLoading(true);
    try {
      const res=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
      const data=await res.json();
      if(!res.ok){setError(data.error||'Unable to send verification code.');setLoading(false);return;}
      setStep('otp'); startCooldown();
    } catch { setError('Unable to send the verification code right now.'); }
    setLoading(false);
  }

  async function verifyOtp(e:FormEvent) {
    e.preventDefault(); setError('');
    if(!/^\d{6}$/.test(otp)){setError('Enter the 6-digit verification code.');return;}
    setLoading(true);
    try {
      const res=await fetch('/api/auth/signup/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp})});
      const data=await res.json();
      if(!res.ok){setError(data.error||'Verification failed.');setLoading(false);return;}
      const r=await signIn('credentials',{email:email.trim(),password,role:'customer',redirect:false,callbackUrl:'/account'});
      if(r?.error){setError('Email verified, but automatic sign-in failed. Please sign in manually.');setLoading(false);return;}
      window.location.href=r?.url||'/account';
    } catch { setError('Unable to verify your email right now.'); setLoading(false); }
  }

  async function resendOtp() {
    if(cooldown||resending)return;
    setError('');setResending(true);
    try {
      const res=await fetch('/api/auth/signup/resend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
      const data=await res.json();
      if(!res.ok){setError(data.error||'Unable to resend the code.');setResending(false);return;}
      setOtp('');startCooldown();
    } catch { setError('Unable to resend the verification code.'); }
    setResending(false);
  }

  return <main className="relative min-h-screen overflow-hidden bg-[#070b16] px-4 py-6 text-white sm:px-6 sm:py-10">
    <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-fuchsia-600/25 blur-3xl"/><div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl"/>
    <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1222] shadow-[0_30px_100px_rgba(0,0,0,.5)] md:grid-cols-2">
      <section className="flex min-h-[680px] flex-col justify-center bg-gradient-to-br from-fuchsia-700 via-violet-700 to-slate-950 p-8 sm:p-12 lg:p-14"><Link href="/" className="text-2xl font-black">🛍️ Zenvora<span className="text-fuchsia-200">.</span></Link><div className="mt-16 max-w-md"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em]">Join Zenvora today</span><h1 className="mt-6 text-5xl font-black leading-tight">Good products.<br/><span className="text-fuchsia-200">Better days.</span></h1><p className="mt-5 leading-7 text-violet-100">Verify your email to secure your account and keep your Zenvora shopping experience connected.</p></div></section>
      <section className="flex min-h-[680px] items-center p-6 sm:p-10 lg:p-14"><div className="w-full max-w-md mx-auto">
        <div className="mb-8 flex items-center justify-between md:hidden"><Link href="/" className="text-xl font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link><span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-bold text-fuchsia-200">Customer</span></div>
        <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white">← Back to store</Link>
        {step==='details'?<><p className="mt-8 text-sm font-black uppercase tracking-[.2em] text-fuchsia-400">New customer</p><h1 className="mt-2 text-4xl font-black tracking-tight">Create account</h1><p className="mt-3 text-sm leading-6 text-slate-400">We'll send a 6-digit code to verify your email.</p>
          <form onSubmit={requestOtp} className="mt-8 space-y-4">
            <label className="block text-sm font-bold text-slate-200">Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your full name" className="mt-2 h-13 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/></label>
            <label className="block text-sm font-bold text-slate-200">Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="mt-2 h-13 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/></label>
            <label className="block text-sm font-bold text-slate-200">Password<div className="relative mt-2"><input required minLength={12} type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters" className="h-13 w-full rounded-2xl border border-white/10 bg-white/5 px-4 pr-20 py-3.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10">{show?'Hide':'Show'}</button></div></label>
            <label className="block text-sm font-bold text-slate-200">Confirm password<input required minLength={12} type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password" className="mt-2 h-13 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/></label>
            {error&&<div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
            <button disabled={loading} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 disabled:opacity-60">{loading?'Sending code…':'Continue & Verify Email →'}</button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-400">Already have an account? <Link href="/login" className="font-bold text-fuchsia-400 hover:text-fuchsia-300">Sign in</Link></p>
        </>:<><p className="mt-8 text-sm font-black uppercase tracking-[.2em] text-fuchsia-400">Verify email</p><h1 className="mt-2 text-4xl font-black tracking-tight">Enter your code</h1><p className="mt-3 text-sm leading-6 text-slate-400">We sent a 6-digit verification code to <span className="font-bold text-slate-200">{email}</span>. It expires in 10 minutes.</p>
          <form onSubmit={verifyOtp} className="mt-8 space-y-5">
            <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-3xl font-black tracking-[.5em] text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"/>
            {error&&<div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
            <button disabled={loading} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black shadow-lg shadow-violet-900/20 disabled:opacity-60">{loading?'Verifying…':'Verify Email & Create Account →'}</button>
          </form>
          <div className="mt-6 flex items-center justify-between text-sm"><button type="button" onClick={()=>{setStep('details');setError('');}} className="font-bold text-slate-400 hover:text-white">← Edit details</button><button type="button" disabled={cooldown>0||resending} onClick={resendOtp} className="font-bold text-fuchsia-400 disabled:text-slate-600">{resending?'Sending…':cooldown?('Resend in '+cooldown+'s'):'Resend code'}</button></div>
        </>}
      </div></section>
    </div>
  </main>;
}
