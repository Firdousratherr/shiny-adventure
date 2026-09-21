const SHOPIFY_API_VERSION = '2026-07';

export function normalizeShopifyDomain(value: unknown) {
  return String(value ?? '').trim().replace(/^https?:\\/\\//i, '').replace(/\\/$/, '').toLowerCase();
}

export function validateShopifyDomain(value: unknown) {
  const domain = normalizeShopifyDomain(value);
  if (!/^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$/i.test(domain)) {
    throw new Error('Use the Shopify store domain in the form your-store.myshopify.com.');
  }
  return domain;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }); }
  finally { clearTimeout(timer); }
}

export async function getShopifyAccessToken(credentials: Record<string, unknown>) {
  const domain = validateShopifyDomain(credentials.storeDomain);
  const clientId = String(credentials.clientId ?? '').trim();
  const clientSecret = String(credentials.clientSecret ?? '').trim();
  if (!clientId || !clientSecret) throw new Error('Shopify Client ID and Client Secret are required.');

  const response = await fetchWithTimeout(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== 'string') {
    const reason = data.error_description || data.error;
    if (reason === 'shop_not_permitted') {
      throw new Error('Shopify rejected this store: the app and store must belong to the same Shopify organization for client-credentials authentication.');
    }
    throw new Error(reason || `Shopify authentication failed (HTTP ${response.status}).`);
  }

  return { domain, accessToken: data.access_token as string, expiresIn: Number(data.expires_in || 86399) };
}

export async function testShopifyConnection(credentials: Record<string, unknown>) {
  const { domain, accessToken, expiresIn } = await getShopifyAccessToken(credentials);
  const response = await fetchWithTimeout(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query: '{ shop { id name myshopifyDomain } }' }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data.errors?.length) {
    throw new Error(data.errors?.map((e: any) => e.message).join('; ') || `Shopify Admin API failed (HTTP ${response.status}).`);
  }
  const shop = data.data?.shop;
  if (!shop?.name) throw new Error('Shopify authenticated but did not return store information.');
  return { domain, shopName: shop.name as string, shopId: shop.id as string, expiresIn };
}

export { SHOPIFY_API_VERSION };
