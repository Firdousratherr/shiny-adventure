import { NextResponse } from 'next/server';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encrypt(value: string) {
  const secret = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEY or AUTH_SECRET must be configured.');

  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function safeRedirect(origin: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const shopParam = url.searchParams.get('shop') || '';
  const error = url.searchParams.get('error');

  const expectedState = request.headers
    .get('cookie')
    ?.split(';')
    .map(v => v.trim())
    .find(v => v.startsWith('zenvora_shopify_oauth_state='))
    ?.slice('zenvora_shopify_oauth_state='.length) || '';

  const expectedShop = request.headers
    .get('cookie')
    ?.split(';')
    .map(v => v.trim())
    .find(v => v.startsWith('zenvora_shopify_oauth_shop='))
    ?.slice('zenvora_shopify_oauth_shop='.length) || '';

  if (error) {
    return safeRedirect(url.origin, '/admin', { shopify: 'cancelled' });
  }

  if (!state || !code || !expectedState || state !== expectedState) {
    return safeRedirect(url.origin, '/admin', { shopify: 'invalid_state' });
  }

  const shop = (shopParam || expectedShop).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    return safeRedirect(url.origin, '/admin', { shopify: 'invalid_shop' });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return safeRedirect(url.origin, '/admin', { shopify: 'missing_credentials' });
  }

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
      cache: 'no-store',
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== 'string') {
      console.error('Shopify OAuth token exchange failed:', tokenData);
      return safeRedirect(url.origin, '/admin', { shopify: 'token_exchange_failed' });
    }

    const integration = await db.marketplaceIntegration.upsert({
      where: { provider: 'SHOPIFY' },
      update: {
        enabled: true,
        lastError: null,
        healthStatus: 'CONNECTED',
        credentialsEncrypted: encrypt(JSON.stringify({
          shop,
          accessToken: tokenData.access_token,
          scope: tokenData.scope || '',
          connectedAt: new Date().toISOString(),
        })),
        settings: {
          shop,
          scope: tokenData.scope || '',
          connectedAt: new Date().toISOString(),
        },
      },
      create: {
        provider: 'SHOPIFY',
        enabled: true,
        autoSync: false,
        healthStatus: 'CONNECTED',
        credentialsEncrypted: encrypt(JSON.stringify({
          shop,
          accessToken: tokenData.access_token,
          scope: tokenData.scope || '',
          connectedAt: new Date().toISOString(),
        })),
        settings: {
          shop,
          scope: tokenData.scope || '',
          connectedAt: new Date().toISOString(),
        },
      },
    });

    const response = safeRedirect(url.origin, '/admin', {
      shopify: 'connected',
      integration: integration.id,
    });
    response.cookies.delete('zenvora_shopify_oauth_state');
    response.cookies.delete('zenvora_shopify_oauth_shop');
    return response;
  } catch (error) {
    console.error('Shopify OAuth callback failed:', error);
    return safeRedirect(url.origin, '/admin', { shopify: 'callback_failed' });
  }
}
