import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '../components/cart-provider';
import MobileNav from '../components/mobile-nav';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: { default: 'Zenvora', template: '%s | Zenvora' },
  description: 'Everyday products for Indian shoppers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          {children}
          <MobileNav />
        </CartProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}