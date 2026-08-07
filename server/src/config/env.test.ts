import { describe, expect, it } from 'vitest';

import { loadAppConfig } from './env';

describe('loadAppConfig', () => {
  it('allows running without database configuration', () => {
    const config = loadAppConfig({ NODE_ENV: 'development' });

    expect(config.database).toBeNull();
    expect(config.port).toBe(3001);
  });

  it('rejects partial MySQL configuration', () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: 'development',
        MYSQL_HOST: 'localhost',
        MYSQL_DATABASE: 'jamesai',
      }),
    ).toThrow(/Missing required environment variables for MySQL-enabled mode/);
  });

  it('accepts a complete MySQL configuration', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'mail.scouty.ca',
      EMAIL_PORT: '587',
      EMAIL_SECURE: 'false',
      EMAIL_USER: 'do.not.reply@scouty.ca',
      EMAIL_API_KEY: 'smtp-secret',
      EMAIL_FROM: 'Scouty <do.not.reply@scouty.ca>',
      CONTACT_EMAIL_TO: 'contact@example.com',
      EMAIL_TOKEN_PEPPER: 'y'.repeat(32),
      MYSQL_HOST: 'db.example.com',
      MYSQL_PORT: '3306',
      MYSQL_DATABASE: 'jamesai',
      MYSQL_USER: 'app_user',
      MYSQL_PASSWORD: 'secret-value',
      MYSQL_SSL_MODE: 'verify-full',
      MYSQL_SSL_CA: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
      DATABASE_CONNECTION_LIMIT: '5',
      SESSION_TOKEN_PEPPER: 'x'.repeat(32),
      FRONTEND_ORIGIN: 'https://app.example.com',
      APP_BASE_URL: 'https://app.example.com',
    });

    expect(config.database).toMatchObject({
      host: 'db.example.com',
      port: 3306,
      database: 'jamesai',
      user: 'app_user',
      sslMode: 'verify-full',
      connectionLimit: 5,
    });
  });

  it('accepts a Brevo SMTP login with a Scouty sender identity', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'smtp',
      EMAIL_HOST: 'smtp-relay.brevo.com',
      EMAIL_PORT: '587',
      EMAIL_SECURE: 'false',
      EMAIL_USER: 'b4b627001@smtp-brevo.com',
      EMAIL_API_KEY: 'smtp-secret',
      EMAIL_FROM: 'Scouty <do.not.reply@scouty.ca>',
      CONTACT_EMAIL_TO: 'support@scouty.ca',
      EMAIL_TOKEN_PEPPER: 'y'.repeat(32),
      MYSQL_HOST: 'db.example.com',
      MYSQL_PORT: '3306',
      MYSQL_DATABASE: 'jamesai',
      MYSQL_USER: 'app_user',
      MYSQL_PASSWORD: 'secret-value',
      MYSQL_SSL_MODE: 'verify-full',
      MYSQL_SSL_CA: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
      DATABASE_CONNECTION_LIMIT: '5',
      SESSION_TOKEN_PEPPER: 'x'.repeat(32),
      FRONTEND_ORIGIN: 'https://app.example.com',
      APP_BASE_URL: 'https://app.example.com',
    });

    expect(config.emailUser).toBe('b4b627001@smtp-brevo.com');
    expect(config.emailFrom).toBe('Scouty <do.not.reply@scouty.ca>');
  });

  it('rejects smtp mode when the contact recipient is missing', () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'smtp',
        EMAIL_HOST: 'mail.scouty.ca',
        EMAIL_PORT: '465',
        EMAIL_SECURE: 'true',
        EMAIL_USER: 'do.not.reply@scouty.ca',
        EMAIL_API_KEY: 'smtp-secret',
        EMAIL_FROM: 'Scouty <do.not.reply@scouty.ca>',
        EMAIL_TOKEN_PEPPER: 'y'.repeat(32),
        MYSQL_HOST: 'db.example.com',
        MYSQL_PORT: '3306',
        MYSQL_DATABASE: 'jamesai',
        MYSQL_USER: 'app_user',
        MYSQL_PASSWORD: 'secret-value',
        MYSQL_SSL_MODE: 'verify-full',
        MYSQL_SSL_CA: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
        DATABASE_CONNECTION_LIMIT: '5',
        SESSION_TOKEN_PEPPER: 'x'.repeat(32),
        FRONTEND_ORIGIN: 'https://app.example.com',
        APP_BASE_URL: 'https://app.example.com',
      }),
    ).toThrow(/CONTACT_EMAIL_TO/);
  });

  it('rejects smtp mode when sender identity or login is not authorized', () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'smtp',
        EMAIL_HOST: 'mail.scouty.ca',
        EMAIL_PORT: '465',
        EMAIL_SECURE: 'true',
        EMAIL_USER: 'mailer@example.com',
        EMAIL_API_KEY: 'smtp-secret',
        EMAIL_FROM: 'Scouty <mailer@example.com>',
        CONTACT_EMAIL_TO: 'contact@example.com',
        EMAIL_TOKEN_PEPPER: 'y'.repeat(32),
        MYSQL_HOST: 'db.example.com',
        MYSQL_PORT: '3306',
        MYSQL_DATABASE: 'jamesai',
        MYSQL_USER: 'app_user',
        MYSQL_PASSWORD: 'secret-value',
        MYSQL_SSL_MODE: 'verify-full',
        MYSQL_SSL_CA: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
        DATABASE_CONNECTION_LIMIT: '5',
        SESSION_TOKEN_PEPPER: 'x'.repeat(32),
        FRONTEND_ORIGIN: 'https://app.example.com',
        APP_BASE_URL: 'https://app.example.com',
      }),
    ).toThrow(/authorized @scouty\.ca sender identity|authorized @scouty\.ca mailbox or Brevo SMTP login/);
  });
});
