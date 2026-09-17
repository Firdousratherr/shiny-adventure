import './globals.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:{default:'ShopKart',template:'%s | ShopKart'},description:'Everyday products for Indian shoppers'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
