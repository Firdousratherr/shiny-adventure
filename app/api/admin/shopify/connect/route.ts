import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminAccess } from '@/lib/admin-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_orders',
  'write_orders',
  'read_fulfillments',
  'write_fulfillments',
];

function normalizeShop(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

export async function GET(request: Request) {
  const admin = await getAdminAccess();
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop') || process.env.SHOPIFY_STORE_DOMAIN || '');

  if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    return NextResponse.json(
      { error: 'Provide a valid Shopify store domain, for example your-store.myshopify.com.' },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json({ error: 'SHOPIFY_CLIENT_ID is not configured.' }, { status: 500 });
  }

  const state = randomBytes(32).toString('hex');
  const callbackUrl = new URL('/api/admin/shopify/callback', url.origin).toString();
  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('scope', SHOPIFY_SCOPES.join(','));
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set('zenvora_shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/admin/shopify',
    maxAge: 10 * 60,
  });
  response.cookies.set('zenvora_shopify_oauth_shop', shop, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/admin/shopify',
    maxAge: 10 * 60,
  });

  return response;
}
