export function getScrapingBeeApiKey() {
  return (process.env.SCRAPINGBEE_API_KEY ?? process.env.SCRAPINGBEE_API_TOKEN ?? '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

export function hasScrapingBeeApiKey() {
  return Boolean(getScrapingBeeApiKey());
}
