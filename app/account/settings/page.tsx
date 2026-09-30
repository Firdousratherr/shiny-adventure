import Link from 'next/link';
import { auth } from '../../../auth';
import StoreHeader from '../../../components/store-header';

function SettingRow({ icon, title, description, href, danger=false }: { icon:string; title:string; description:string; href:string; danger?:boolean }) {
  return <Link href={href} className={'zenvora-setting-row' + (danger ? ' zenvora-setting-danger' : '')}>
    <span className="zenvora-setting-icon" aria-hidden="true">{icon}</span>
    <span className="min-w-0 flex-1"><strong>{title}</strong><small>{description}</small></span>
    <span className="zenvora-setting-arrow" aria-hidden="true">→</span>
  </Link>;
}

export default async function AccountSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== 'customer') {
    return <main className="store-dark min-h-screen"><StoreHeader /><div className="container py-16"><div className="zenvora-empty-state mx-auto max-w-lg"><h1 className="text-2xl font-black">Sign in to manage your account</h1><p className="mt-2 text-sm text-slate-500">Your account settings are available after signing in.</p><Link href="/login?callbackUrl=/account/settings" className="mt-6 inline-flex rounded-xl bg-violet-700 px-6 py-3 font-black text-white">Sign in</Link></div></div></main>;
  }

  return <main className="store-dark min-h-screen pb-28 sm:pb-10">
    <StoreHeader loggedIn />
    <div className="container py-8 sm:py-10">
      <div className="zenvora-page-hero">
        <div>
          <span className="inline-flex rounded-full border bg-violet-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-700">Your account</span>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">Account settings</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Manage your profile, security and shopping preferences from one place.</p>
        </div>
        <Link href="/account" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:border-violet-300 hover:text-violet-700 sm:inline-flex">← My account</Link>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="zenvora-settings-card">
          <p className="zenvora-settings-label">Profile & login</p>
          <div className="mt-3 space-y-2">
            <SettingRow icon="♙" title="Edit profile" description="Update your name and customer details." href="/account/profile" />
            <SettingRow icon="⌑" title="Change password" description="Use secure password recovery to set a new password." href="/account/password" />
          </div>
        </section>

        <section className="zenvora-settings-card">
          <p className="zenvora-settings-label">Shopping</p>
          <div className="mt-3 space-y-2">
            <SettingRow icon="♡" title="Wishlist" description="View products you saved for later." href="/account/wishlist" />
            <SettingRow icon="◌" title="Recently viewed" description="Return to products you recently checked." href="/account/recently-viewed" />
            <SettingRow icon="⌖" title="Saved addresses" description="Manage your delivery addresses." href="/account/addresses" />
            <SettingRow icon="▣" title="Payment preferences" description="Choose your preferred checkout method." href="/account/payment-methods" />
          </div>
        </section>

        <section className="zenvora-settings-card">
          <p className="zenvora-settings-label">Privacy & security</p>
          <div className="mt-3 space-y-2">
            <div className="zenvora-setting-row zenvora-setting-static">
              <span className="zenvora-setting-icon">✉</span>
              <span className="min-w-0 flex-1"><strong>Email account</strong><small>{session.user.email || 'Signed-in customer account'}</small></span>
              <span className="zenvora-setting-badge">SECURE</span>
            </div>
            <div className="zenvora-setting-row zenvora-setting-static">
              <span className="zenvora-setting-icon">✓</span>
              <span className="min-w-0 flex-1"><strong>Account protection</strong><small>Customer access is protected by authenticated sessions.</small></span>
              <span className="zenvora-setting-badge">ON</span>
            </div>
          </div>
        </section>

        <section className="zenvora-settings-card">
          <p className="zenvora-settings-label">Help</p>
          <div className="mt-3 space-y-2">
            <SettingRow icon="?" title="Track an order" description="Check delivery status using your order details." href="/track-order" />
            <SettingRow icon="◷" title="My orders" description="View your purchase history and order status." href="/account/orders" />
            <SettingRow icon="◉" title="Notifications" description="Read your order and account updates." href="/account/notifications" />
            <SettingRow icon="?" title="Help & support" description="Create a support ticket and view replies." href="/account/support" />
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[24px] border border-rose-100 bg-rose-50/60 p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-rose-600">Danger zone</p>
        <h2 className="mt-2 text-lg font-black text-slate-900">Account deletion</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Delete your customer account and saved personal data. Historical orders are retained in anonymized form for operational records.</p><Link href="/account/delete" className="mt-4 inline-flex rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-black text-rose-700">Delete account</Link>
      </section>
    </div>
  </main>;
}
