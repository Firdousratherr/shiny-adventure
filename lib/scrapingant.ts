export function getScrapingAntApiKey() {
  return (process.env.SCRAPINGANT_API_KEY ?? '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

export function hasScrapingAntApiKey() {
  return Boolean(getScrapingAntApiKey());
}


export type ScrapingAntUsage = {
  planName: string | null;
  totalCredits: number | null;
  remainingCredits: number | null;
};

export async function getScrapingAntUsage(): Promise<ScrapingAntUsage> {
  const key = getScrapingAntApiKey();
  if (!key) return { planName: null, totalCredits: null, remainingCredits: null };

  try {
    const endpoint = new URL('https://api.scrapingant.com/v2/usage');
    endpoint.searchParams.set('x-api-key', key);
    const response = await fetch(endpoint.toString(), { cache: 'no-store' });
    if (!response.ok) return { planName: null, totalCredits: null, remainingCredits: null };
    const data = await response.json();
    return {
      planName: typeof data?.plan_name === 'string' ? data.plan_name : null,
      totalCredits: Number.isFinite(Number(data?.plan_total_credits)) ? Number(data.plan_total_credits) : null,
      remainingCredits: Number.isFinite(Number(data?.remained_credits)) ? Number(data.remained_credits) : null,
    };
  } catch {
    return { planName: null, totalCredits: null, remainingCredits: null };
  }
}
