import 'dotenv/config';

import { ProductAnalyticsRepository } from './product-analytics-repository';
import { ProductAnalyticsService } from './product-analytics';
import { loadAppConfig } from '../config/env';
import { createDatabaseConnection } from '../db/client';

function previousUtcDay(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const config = loadAppConfig();
  if (!config.database) throw new Error('MySQL configuration is required');
  const database = createDatabaseConnection(config.database);
  try {
    const service = new ProductAnalyticsService(
      new ProductAnalyticsRepository(database.pool),
      config.jamesConfigurationVersionId ?? null,
    );
    const day = process.env.ANALYTICS_AGGREGATE_DATE?.trim() || previousUtcDay();
    const result = await service.runDailyMaintenance(day);
    console.log(JSON.stringify({ day, deletedRawEvents: result.deleted }));
  } finally {
    await database.pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Analytics maintenance failed');
  process.exitCode = 1;
});
