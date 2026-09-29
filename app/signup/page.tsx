'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

type SignInResult = { error?: string; url?: string } | undefined;

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [verification, setVerification] = useState(false);
  const [otp, setOtp] = useState('');

  async function googleSignIn() {
    setError('');
    setLoading(true);
    try {
      const r = (await signIn('google', { callbackUrl: '/account' })) as SignInResult;
      if (r?.error) { setError('Google sign-in is not configured correctly yet.'); setLoading(false); }
    } catch { setError('Google sign-in is temporarily unavailable.'); setLoading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);

    try {
      let signInResult: SignInResult;
      if (verification) {
        const res = await fetch('/api/auth/signup/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
        const result = await res.json();
        if (!res.ok) { setError(result.error || 'Invalid verification code.'); setLoading(false); return; }
      } else {
        const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
        const result = await res.json();
        if (!res.ok) { setError(result.error || 'Unable to send verification code.'); setLoading(false); return; }
        setVerification(true);
        setLoading(false);
        return;
      }

      signInResult = (await signIn('credentials', { email: email.trim(), password, role: 'customer', redirect: false, callbackUrl: '/account' })) as SignInResult;
      if (signInResult?.error) { setError('Account created, but automatic sign-in failed. Please sign in manually.'); setLoading(false); return; }
      window.location.href = signInResult?.url || '/account';
    } catch {
      setError('Unable to create your account right now.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-3 py-3 text-slate-900 sm:px-5 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl shadow-violet-950/10 sm:min-h-[calc(100vh-3rem)] md:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#171047] via-[#7c2dbe] to-[#d946ef] p-8 text-white md:flex md:flex-col md:justify-center lg:p-11">
          <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
          <Link href="/" className="relative text-xl font-black">Zenvora<span className="text-cyan-200">.</span></Link>
          <div className="relative mt-12 max-w-md">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em]">Join Zenvora</span>
            <h1 className="mt-5 text-5xl font-black leading-[.98] tracking-[-.04em]">Discover more.<br /><span className="text-cyan-200">Shop better.</span></h1>
            <p className="mt-5 text-sm leading-7 text-fuchsia-100/80">Create your account to save addresses, manage orders and keep your shopping experience connected.</p>
          </div>
        </section>

        <section className="flex items-center px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex items-center justify-between md:hidden">
              <Link href="/" className="text-lg font-black tracking-tight">Zenvora<span className="text-fuchsia-500">.</span></Link>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">Customer</span>
            </div>
            <Link href="/" className="text-xs font-bold text-slate-400 hover:text-violet-700">← Back to store</Link>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-600">New customer</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-.03em] sm:text-4xl">{verification ? 'Verify your account' : 'Create account'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{verification ? <>Enter the 6-digit code sent to <b className="text-slate-800">{email}</b>.</> : 'Create your customer account and start shopping.'}</p>

            {!verification ? <button type="button" onClick={googleSignIn} disabled={loading} className="mt-6 h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 shadow-sm hover:border-violet-300 hover:bg-violet-50 disabled:opacity-60">Continue with Google</button> : null}

            {!verification ? <div className="my-5 flex items-center gap-3 text-[10px] font-black text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div> : null}

            <form onSubmit={submit} className="space-y-3.5">
              {!verification ? <>
                <label className="block text-xs font-black text-slate-700">Full name<input required minLength={2} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Your full name" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /></label>
                <label className="block text-xs font-black text-slate-700">Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /></label>
                <label className="block text-xs font-black text-slate-700">Password<div className="relative mt-1.5"><input required minLength={12} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-16 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black text-slate-400 hover:bg-violet-50 hover:text-violet-700">{show ? 'Hide' : 'Show'}</button></div></label>
                <label className="block text-xs font-black text-slate-700">Confirm password<input required minLength={12} type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /></label>
              </> : <label className="block text-xs font-black text-slate-700">Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" placeholder="123456" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-xl font-black tracking-[.5em] text-slate-900 outline-none placeholder:text-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /></label>}

              {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">{error}</div> : null}

              <button disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-700 via-violet-600 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-violet-500/20 hover:-translate-y-0.5 disabled:opacity-60">{loading ? (verification ? 'Verifying…' : 'Sending code…') : (verification ? 'Verify & Create Account →' : 'Send Verification Code →')}</button>
              {verification ? <button type="button" onClick={() => { setVerification(false); setOtp(''); setError(''); }} className="w-full text-xs font-bold text-slate-400 hover:text-violet-700">← Change email or details</button> : null}
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">Already have an account? <Link href="/login" className="font-black text-violet-700 hover:text-fuchsia-600">Sign in</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
