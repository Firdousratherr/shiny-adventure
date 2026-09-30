'use client';

import { useState } from 'react';

type Props = {
  signOutAction: () => Promise<void>;
};

const items = [
  { href: '/account', label: 'Overview', icon: '⌂' },
  { href: '/account/profile', label: 'Edit profile', icon: '✎' },
  { href: '/account/addresses', label: 'Saved addresses', icon: '⌖' },
  { href: '/products', label: 'Continue shopping', icon: '↗' },
  { href: '/track', label: 'Track an order', icon: '↗' },
  { href: '/account/wishlist', label: 'Wishlist', icon: '♥' },
  { href: '/account/recently-viewed', label: 'Recently viewed', icon: '◌' },
  { href: '/account/settings', label: 'Account settings', icon: '⚙' },
  { href: '/account/notifications', label: 'Notifications', icon: '●' },
  { href: '/account/support', label: 'Help & support', icon: '?' },
];

export default function AccountMenu({ signOutAction }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="zenvora-account-menu">
      <button
        type="button"
        className="zenvora-account-menu-trigger"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="zenvora-menu-icon" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Account menu</span>
        <span className={'zenvora-menu-chevron ' + (open ? 'is-open' : '')} aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div id="account-menu-panel" className="zenvora-account-menu-panel">
          <div className="px-2 pb-2 pt-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Quick access</p>
          </div>

          <nav className="space-y-1" aria-label="Account options">
            {items.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="zenvora-account-menu-item">
                <span className="zenvora-account-menu-item-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto text-slate-400" aria-hidden="true">→</span>
              </a>
            ))}
          </nav>

          <div className="my-2 border-t border-slate-100" />

          <form action={signOutAction}>
            <button type="submit" className="zenvora-account-signout">
              <span className="zenvora-account-menu-item-icon" aria-hidden="true">↪</span>
              <span>Sign out</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
