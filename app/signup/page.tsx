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
      if (r?.error) {
        setError('Google sign-in is not configured correctly yet.');
        setLoading(false);
      }
    } catch {
      setError('Google sign-in is temporarily unavailable.');
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);

    try {
      let signInResult: SignInResult;

      if (verification) {
        const res = await fetch('/api/auth/signup/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        });
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || 'Invalid verification code.');
          setLoading(false);
          return;
        }
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || 'Unable to send verification code.');
          setLoading(false);
          return;
        }
        setVerification(true);
        setLoading(false);
        return;
      }

      signInResult = (await signIn('credentials', {
        email: email.trim(),
        password,
        role: 'customer',
        redirect: false,
        callbackUrl: '/account',
      })) as SignInResult;

      if (signInResult?.error) {
        setError('Account created, but automatic sign-in failed. Please sign in manually.');
        setLoading(false);
        return;
      }

      window.location.href = signInResult?.url || '/account';
    } catch {
      setError('Unable to create your account right now.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070b16] px-3 py-3 text-white sm:px-5 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c1222] shadow-2xl sm:min-h-[calc(100vh-3rem)] sm:rounded-[1.5rem] md:grid-cols-2">
        <section className="hidden flex-col justify-center bg-gradient-to-br from-fuchsia-700 via-violet-700 to-slate-950 p-8 md:flex lg:p-10">
          <Link href="/" className="text-xl font-black">🛍️ Zenvora<span className="text-fuchsia-200">.</span></Link>
          <div className="mt-12 max-w-sm">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em]">Join Zenvora today</span>
            <h1 className="mt-5 text-4xl font-black leading-tight lg:text-5xl">Good products.<br /><span className="text-fuchsia-200">Better days.</span></h1>
            <p className="mt-4 text-sm leading-6 text-violet-100">Create your customer account and keep your shopping experience connected.</p>
          </div>
        </section>

        <section className="flex items-center px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-5 flex items-center justify-between md:hidden">
              <Link href="/" className="text-lg font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link>
              <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[10px] font-bold text-fuchsia-200">Customer</span>
            </div>

            <Link href="/" className="text-xs font-semibold text-slate-400 hover:text-white">← Back to store</Link>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-400">New customer</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Create account</h1>
            <p className="mt-2 text-xs leading-5 text-slate-400">{verification ? <>Enter the 6-digit code sent to <b className="text-slate-200">{email}</b>.</> : 'Create your customer account.'}</p>

            <button type="button" onClick={googleSignIn} disabled={loading} className="mt-5 h-12 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-black transition hover:bg-white/10 disabled:opacity-60">Continue with Google</button>

            {!verification && <div className="my-4 flex items-center gap-3 text-[10px] font-semibold text-slate-500"><span className="h-px flex-1 bg-white/10" /><span>OR</span><span className="h-px flex-1 bg-white/10" /></div>}

            <form onSubmit={submit} className="space-y-3">
              {!verification && <>
                <label className="block text-xs font-bold text-slate-200">Full name<input required minLength={2} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Your full name" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
                <label className="block text-xs font-bold text-slate-200">Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
                <label className="block text-xs font-bold text-slate-200">Password<div className="relative mt-1.5"><input required minLength={12} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 pr-16 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-white/10">{show ? 'Hide' : 'Show'}</button></div></label>
                <label className="block text-xs font-bold text-slate-200">Confirm password<input required minLength={12} type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
              </>}

              {verification && <label className="block text-xs font-bold text-slate-200">Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" placeholder="123456" className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-center text-xl font-black tracking-[.5em] text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>}

              {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300">{error}</div>}

              <button disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-sm font-black shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 disabled:opacity-60">{loading ? (verification ? 'Verifying…' : 'Sending code…') : (verification ? 'Verify & Create Account →' : 'Send Verification Code →')}</button>
              {verification && <button type="button" onClick={() => { setVerification(false); setOtp(''); setError(''); }} className="w-full text-xs font-bold text-slate-400 hover:text-white">← Change email or details</button>}
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">Already have an account? <Link href="/login" className="font-bold text-fuchsia-400 hover:text-fuchsia-300">Sign in</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
