import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '../components/cart-provider';

export const metadata: Metadata = {
  title: { default: 'Zenvora', template: '%s | Zenvora' },
  description: 'Everyday products for Indian shoppers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><CartProvider>{children}</CartProvider></body></html>;
}
