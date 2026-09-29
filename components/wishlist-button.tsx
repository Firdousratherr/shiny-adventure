'use client';

import { useEffect, useState } from 'react';

export default function WishlistButton({ productId }: { productId: string }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/wishlist', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          if (alive) setSignedOut(true);
          return;
        }
        if (!r.ok) return;
        const data = await r.json();
        const exists = Array.isArray(data.items) && data.items.some((item: any) => item?.product?.id === productId);
        if (alive) setActive(exists);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [productId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (active) {
        const r = await fetch('/api/wishlist?productId=' + encodeURIComponent(productId), { method: 'DELETE' });
        if (r.ok) setActive(false);
        else if (r.status === 401) setSignedOut(true);
      } else {
        const r = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        if (r.ok) setActive(true);
        else if (r.status === 401) setSignedOut(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (signedOut) {
    return (
      <a
        href="/login?callbackUrl=/account"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[.035] px-4 text-sm font-bold text-slate-200 hover:bg-white/[.07]"
      >
        ♡ Save to wishlist
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold transition ${
        active
          ? 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200'
          : 'border-white/10 bg-white/[.035] text-slate-200 hover:bg-white/[.07]'
      } disabled:opacity-50`}
    >
      {active ? '♥ Saved' : '♡ Save to wishlist'}
    </button>
  );
}
