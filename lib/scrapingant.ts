export function getScrapingAntApiKey() {
  return (process.env.SCRAPINGANT_API_KEY ?? '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

export function hasScrapingAntApiKey() {
  return Boolean(getScrapingAntApiKey());
}
