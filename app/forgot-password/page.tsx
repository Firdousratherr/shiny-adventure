'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPassword() {
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [step,setStep]=useState<1|2>(1);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  async function submit(e:FormEvent) {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (step===1) {
        const res=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
        const result=await res.json();
        if(!res.ok){setError(result.error||'Unable to send reset code.');setLoading(false);return;}
        setMessage('If an account exists for this email, a reset code has been sent.');
        setStep(2);
      } else {
        if(password!==confirm){setError('Passwords do not match.');setLoading(false);return;}
        const res=await fetch('/api/auth/forgot-password/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp,password})});
        const result=await res.json();
        if(!res.ok){setError(result.error||'Unable to reset password.');setLoading(false);return;}
        window.location.href='/login?reset=success';
      }
    } catch { setError('Something went wrong. Please try again.'); }
    setLoading(false);
  }

  return <main className="min-h-screen bg-[#070b16] px-4 py-10 text-white">
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
      <div className="w-full rounded-[2rem] border border-white/10 bg-[#0c1222] p-7 shadow-[0_30px_100px_rgba(0,0,0,.5)] sm:p-10">
        <Link href="/" className="text-2xl font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link>
        <p className="mt-10 text-sm font-black uppercase tracking-[.2em] text-fuchsia-400">Account recovery</p>
        <h1 className="mt-2 text-4xl font-black">Reset password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{step===1 ? 'Enter your email and we will send a 6-digit verification code.' : <>Enter the code sent to <b className="text-slate-200">{email}</b> and choose a new password.</>}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {step===1 ? <label className="block text-sm font-bold text-slate-200">Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"/></label> :
          <><label className="block text-sm font-bold text-slate-200">Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} autoComplete="one-time-code" placeholder="123456" className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-2xl font-black tracking-[.5em] text-white outline-none placeholder:text-slate-600 focus:border-violet-500"/></label>
          <label className="block text-sm font-bold text-slate-200">New password<input required minLength={12} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters" className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"/></label>
          <label className="block text-sm font-bold text-slate-200">Confirm password<input required minLength={12} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password" className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"/></label></>}
          {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}
          {error && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
          <button disabled={loading} className="h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-black disabled:opacity-60">{loading ? 'Please wait…' : step===1 ? 'Send Verification Code →' : 'Reset Password →'}</button>
          {step===2 && <button type="button" onClick={()=>{setStep(1);setOtp('');setMessage('');setError('')}} className="w-full text-sm font-bold text-slate-400 hover:text-white">← Use another email</button>}
        </form>
        <Link href="/login" className="mt-7 block text-center text-sm font-bold text-fuchsia-400">← Back to sign in</Link>
      </div>
    </div>
  </main>;
}
