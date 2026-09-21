import { POST as marketplaceImport } from '../import-marketplace/route';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return marketplaceImport(request);
}
