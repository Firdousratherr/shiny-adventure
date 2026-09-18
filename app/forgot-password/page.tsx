'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function ForgotPassword() {
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [step,setStep]=useState<1|2>(1);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const [cooldown,setCooldown]=useState(0);

  function startCooldown(){
    setCooldown(60);
    const timer=window.setInterval(()=>setCooldown(v=>{if(v<=1){window.clearInterval(timer);return 0;}return v-1;}),1000);
  }

  async function requestCode(e:FormEvent){
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      const r=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Unable to send reset code.');return;}
      setStep(2); setMessage(d.message||'Check your email for the verification code.'); startCooldown();
    } catch { setError('Unable to send reset code right now.'); } finally { setLoading(false); }
  }

  async function reset(e:FormEvent){
    e.preventDefault(); setError(''); setMessage('');
    if(password!==confirm){setError('Passwords do not match.');return;}
    setLoading(true);
    try {
      const r=await fetch('/api/auth/forgot-password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp,password})});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Unable to reset password.');return;}
      setMessage('Password changed. Signing you in…');
      const login=await signIn('credentials',{email,password,role:'customer',redirect:false,callbackUrl:'/account'});
      if(login?.error){window.location.href='/login';return;}
      window.location.href=login?.url||'/account';
    } catch { setError('Unable to reset your password right now.'); } finally { setLoading(false); }
  }

  async function resend(){
    if(cooldown||loading)return;
    setError('');setLoading(true);
    try{
      const r=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const d=await r.json(); if(!r.ok){setError(d.error||'Unable to resend code.');return;}
      setMessage(d.message||'A new code was sent.');startCooldown();
    }catch{setError('Unable to resend code.');}finally{setLoading(false);}
  }

  return <main className="relative min-h-screen overflow-hidden bg-[#070b16] px-4 py-8 text-white sm:px-6">
    <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl"/><div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl"/>
    <div className="relative mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#0c1222] p-6 shadow-[0_30px_100px_rgba(0,0,0,.5)] sm:p-10">
      <Link href="/" className="text-2xl font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link>
      <p className="mt-10 text-sm font-black uppercase tracking-[.2em] text-fuchsia-400">Account security</p>
      <h1 className="mt-2 text-4xl font-black">Forgot password?</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">{step===1?'Enter your account email and we will send a verification code.':'Enter the code from your email and choose a new password.'}</p>
      {step===1 ? <form onSubmit={requestCode} className="mt-8 space-y-5">
        <label className="block text-sm font-bold text-slate-200">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-violet-500"/></label>
        {error&&<div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
        <button disabled={loading} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black disabled:opacity-60">{loading?'Sending…':'Send verification code →'}</button>
      </form> : <form onSubmit={reset} className="mt-8 space-y-5">
        <label className="block text-sm font-bold text-slate-200">Verification code<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-xl font-black tracking-[.4em] text-white outline-none focus:border-violet-500"/></label>
        <label className="block text-sm font-bold text-slate-200">New password<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-violet-500"/></label>
        <label className="block text-sm font-bold text-slate-200">Confirm new password<input required minLength={12} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-violet-500"/></label>
        {error&&<div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
        {message&&<div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}
        <button disabled={loading} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black disabled:opacity-60">{loading?'Updating…':'Reset password →'}</button>
        <div className="flex items-center justify-between text-sm"><button type="button" onClick={resend} disabled={!!cooldown||loading} className="font-bold text-fuchsia-400 disabled:text-slate-600">{cooldown?'Resend in '+cooldown+'s':'Resend code'}</button><button type="button" onClick={()=>{setStep(1);setError('');setMessage('')}} className="font-bold text-slate-400 hover:text-white">Change email</button></div>
      </form>}
      <p className="mt-8 text-center text-sm text-slate-400"><Link href="/login" className="font-bold text-fuchsia-400">← Back to sign in</Link></p>
    </div>
  </main>;
}
