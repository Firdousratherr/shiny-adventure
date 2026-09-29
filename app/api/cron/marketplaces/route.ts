import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { syncMarketplace } from '../../../../lib/marketplaces';
import { releaseExpiredPaymentReservations } from '../../../../lib/inventory-reservations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const released = await db.$transaction(async tx => releaseExpiredPaymentReservations(tx));
  const integrations = await db.marketplaceIntegration.findMany({
    where: { provider: { in: ['SHOPIFY', 'MEESHO'] }, enabled: true, autoSync: true },
  });
  const results: Array<Record<string, unknown>> = [];

  for (const integration of integrations) {
    if (!integration.lastSyncAt) {
      // First automatic run.
    } else {
      const nextAt = new Date(integration.lastSyncAt.getTime() + integration.syncIntervalMinutes * 60_000);
      if (nextAt > now) continue;
    }

    // Prevent the scheduler from overlapping a manual import or a previous
    // scheduler run, and recover locks left behind by a killed function.
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    await db.marketplaceSyncRun.updateMany({
      where: {
        integrationId: integration.id,
        status: 'RUNNING',
        startedAt: { lt: staleBefore },
      },
      data: {
        status: 'FAILED',
        error: 'Stale scheduled run lock cleared automatically.',
        finishedAt: new Date(),
      },
    });
    const activeRun = await db.marketplaceSyncRun.findFirst({
      where: { integrationId: integration.id, status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true },
    });
    if (activeRun) {
      results.push({
        provider: integration.provider,
        status: 'SKIPPED',
        reason: 'An import is already running.',
        runId: activeRun.id,
      });
      continue;
    }

    const started = Date.now();
    const run = await db.marketplaceSyncRun.create({ data: { integrationId: integration.id, type: 'SCHEDULED', status: 'RUNNING' } });
    try {
      const result = await syncMarketplace(integration.id, integration.provider, integration.settings);
      const duration = Date.now() - started;
      await db.marketplaceSyncRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', productsFound: result.found, ordersFound: result.importedOrders, finishedAt: new Date() } });
      await db.marketplaceIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), lastSuccessAt: new Date(), lastError: null, healthStatus: 'HEALTHY', lastSyncDurationMs: duration, importedProducts: { increment: result.importedProducts }, importedOrders: { increment: result.importedOrders } } });
      results.push({ provider: integration.provider, status: 'SUCCESS', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduled sync failed.';
      const duration = Date.now() - started;
      await db.marketplaceSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: message, finishedAt: new Date() } });
      await db.marketplaceIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), lastError: message, healthStatus: 'ERROR', lastSyncDurationMs: duration } });
      results.push({ provider: integration.provider, status: 'FAILED', error: message });
    }
  }

  return NextResponse.json({ checked: integrations.length, releasedExpiredReservations: released, results });
}
