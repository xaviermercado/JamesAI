import dotenv from 'dotenv';
import { z } from 'zod';

import { loadAppConfig } from '../config/env';
import { createDatabaseConnection } from '../db/client';
import { AdminAccessRepository } from './admin-access-repository';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

async function main(): Promise<void> {
  dotenv.config();
  if (process.argv.length !== 3) {
    throw new Error('Usage: npm run admin:provision-owner -- owner@example.com');
  }
  const email = emailSchema.parse(process.argv[2]);
  const config = loadAppConfig(process.env);
  if (!config.database) throw new Error('MySQL configuration is required');

  const database = createDatabaseConnection(config.database);
  try {
    const result = await new AdminAccessRepository(database.pool).provisionOwnerByEmail(email);
    if (result.status === 'not_found') throw new Error('No account exists for that email');
    if (result.status !== 'updated') throw new Error('Owner provisioning was refused');
    process.stdout.write(`${JSON.stringify({
      status: 'updated',
      userId: result.item.userId,
      role: result.item.adminRole,
      revokedSessions: result.revokedSessions,
    })}\n`);
  } finally {
    await database.pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Owner provisioning failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});