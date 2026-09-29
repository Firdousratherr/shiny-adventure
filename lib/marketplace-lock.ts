import 'server-only';

import { randomUUID } from 'crypto';
import { db } from './db';

const STALE_MS = 10 * 60 * 1000;

export async function acquireMarketplaceSyncLock(integrationId: string) {
  const token = randomUUID();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_MS);
  const result = await db.marketplaceIntegration.updateMany({
    where: {
      id: integrationId,
      OR: [
        { syncLockToken: null },
        { syncLockAt: { lt: staleBefore } },
      ],
    },
    data: { syncLockToken: token, syncLockAt: now },
  });
  return result.count === 1 ? token : null;
}

export async function releaseMarketplaceSyncLock(integrationId: string, token: string) {
  await db.marketplaceIntegration.updateMany({
    where: { id: integrationId, syncLockToken: token },
    data: { syncLockToken: null, syncLockAt: null },
  });
}
