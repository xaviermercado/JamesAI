type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

function normalizeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function writeLog(level: LogLevel, event: string, metadata?: Record<string, unknown>): void {
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(metadata ?? {}),
  };

  const pretty = process.env.LOG_PRETTY === 'true';
  const output = JSON.stringify(record, null, pretty ? 2 : undefined);

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
}

export const logger = {
  debug(event: string, metadata?: Record<string, unknown>): void {
    writeLog('debug', event, metadata);
  },
  info(event: string, metadata?: Record<string, unknown>): void {
    writeLog('info', event, metadata);
  },
  warn(event: string, metadata?: Record<string, unknown>): void {
    writeLog('warn', event, metadata);
  },
  error(event: string, metadata?: Record<string, unknown>): void {
    const normalized = { ...(metadata ?? {}) };
    if ('error' in normalized) {
      normalized.error = normalizeError(normalized.error);
    }

    writeLog('error', event, normalized);
  },
};
