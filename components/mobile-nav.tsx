'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './cart-provider';

export default function MobileNav(){
  const pathname=usePathname();
  const {count}=useCart();
  if(pathname?.startsWith('/admin'))return null;
  const items=[['/','Home','⌂'],['/products','Shop','⌕'],['/track','Track','↗'],['/cart','Cart','🛒'],['/account','Account','◉']] as const;
  return <nav className="zenvora-mobile-nav" aria-label="Mobile navigation">{items.map(([href,label,icon])=>{const active=href==='/'?pathname==='/':Boolean(pathname?.startsWith(href));return <Link key={href} href={href} aria-current={active?'page':undefined} className={'zenvora-mobile-nav-item '+(active?'is-active':'')}><span className="relative text-lg leading-none">{icon}{label==='Cart'&&count>0&&<b>{count>99?'99+':count}</b>}</span><span>{label}</span></Link>})}</nav>;
}
