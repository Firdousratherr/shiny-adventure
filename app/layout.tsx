import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '../components/cart-provider';
import MobileNav from '../components/mobile-nav';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Zenvora', template: '%s | Zenvora' },
  description: 'Everyday products for Indian shoppers',
  applicationName: 'Zenvora',
  openGraph: {
    title: 'Zenvora',
    description: 'Everyday products for Indian shoppers',
    siteName: 'Zenvora',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><CartProvider>{children}<MobileNav /></CartProvider><Analytics /><SpeedInsights /></body></html>;
}