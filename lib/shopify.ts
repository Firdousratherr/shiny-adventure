const SHOPIFY_API_VERSION = '2026-07';

export function normalizeShopifyDomain(value: unknown) {
  return String(value ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
}

export function validateShopifyDomain(value: unknown) {
  const domain = normalizeShopifyDomain(value);
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) {
    throw new Error('Use the Shopify store domain in the form your-store.myshopify.com.');
  }
  return domain;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

function graphQLErrorMessage(errors: unknown) {
  if (Array.isArray(errors)) return errors.map((e: any) => String(e?.message || e)).join('; ');
  if (errors && typeof errors === 'object') return Object.values(errors as Record<string, unknown>).map((e: any) => String(e?.message || e)).join('; ');
  return String(errors ?? '');
}

function shopUnavailableError(status: number, message: string) {
  if (/Unavailable Shop|shop is unavailable|shop_unavailable|PAYMENT_REQUIRED/i.test(message) || status === 402 || status === 423) {
    return new Error('Shopify reports that this store is unavailable. Check Shopify Admin for billing, frozen/inactive store status, or an account restriction, then retry.');
  }
  return null;
}

export async function shopifyGraphQL<T = any>(
  credentials: Record<string, unknown>,
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs = 20000,
) {
  const { domain, accessToken } = await getShopifyAccessToken(credentials);
  const response = await fetchWithTimeout('https://' + domain + '/admin/api/' + SHOPIFY_API_VERSION + '/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  }, timeoutMs);

  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Shopify returned a non-JSON response (HTTP ' + response.status + ').');
  }

  if (payload.errors) {
    const detail = graphQLErrorMessage(payload.errors) || 'Unknown Shopify GraphQL error.';
    throw shopUnavailableError(response.status, detail) ?? new Error('Shopify GraphQL error: ' + detail);
  }

  if (!response.ok) {
    const reason = typeof payload?.error === 'string'
      ? payload.error
      : typeof payload?.message === 'string'
        ? payload.message
        : '';
    const message = 'Shopify Admin API returned HTTP ' + response.status + (reason ? ': ' + reason : '.');
    throw shopUnavailableError(response.status, message) ?? new Error(message);
  }

  if (!payload.data) throw new Error('Shopify returned no GraphQL data.');
  return { domain, data: payload.data as T };
}

export async function getShopifyAccessToken(credentials: Record<string, unknown>) {
  const domain = validateShopifyDomain(credentials.storeDomain);
  const clientId = String(credentials.clientId ?? '').trim();
  const clientSecret = String(credentials.clientSecret ?? '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Shopify Client ID and Client Secret are required.');
  }

  const response = await fetchWithTimeout('https://' + domain + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== 'string') {
    const reason = data.error_description || data.error;
    if (reason === 'shop_not_permitted') {
      throw new Error('Shopify rejected this store: the app and store must belong to the same Shopify organization for client-credentials authentication.');
    }
    throw new Error(reason || ('Shopify authentication failed (HTTP ' + response.status + ').'));
  }

  return {
    domain,
    accessToken: data.access_token as string,
    expiresIn: Number(data.expires_in || 86399),
  };
}

export async function testShopifyConnection(credentials: Record<string, unknown>) {
  const { domain, accessToken, expiresIn } = await getShopifyAccessToken(credentials);
  const { data } = await shopifyGraphQL<{ shop?: { id?: string; name?: string; myshopifyDomain?: string } }>(credentials, '{ shop { id name myshopifyDomain } }');
  const shop = data?.shop;
  if (!shop?.name) throw new Error('Shopify authenticated but did not return store information.');

  return {
    domain,
    shopName: shop.name as string,
    shopId: shop.id as string,
    expiresIn,
  };
}

export { SHOPIFY_API_VERSION };
