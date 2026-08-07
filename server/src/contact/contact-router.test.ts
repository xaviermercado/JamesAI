import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../config/env';
import type { EmailService } from '../email/email-service';
import { createContactRouter } from './contact-router';

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3001,
    nodeEnv: 'production',
    tmdbTimeoutMs: 8000,
    openAiModel: 'gpt-4.1-mini',
    openAiTimeoutMs: 8000,
    emailProvider: 'smtp',
    emailHost: 'mail.scouty.ca',
    emailPort: 465,
    emailSecure: true,
    emailUser: 'do.not.reply@scouty.ca',
    emailApiKey: 'smtp-secret',
    emailFrom: 'Scouty <do.not.reply@scouty.ca>',
    contactEmailTo: 'contact@example.com',
    emailTokenPepper: 'y'.repeat(32),
    database: null,
    sessionTokenPepper: 'x'.repeat(32),
    frontendOrigin: 'https://app.scouty.ca',
    appBaseUrl: 'https://app.scouty.ca',
    ...overrides,
  };
}

function createApp(emailService: EmailService, config: AppConfig) {
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter(config, emailService));
  return app;
}

const sendContactEmail = vi.fn();

function createEmailServiceStub() {
  return {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    sendContactEmail,
  } as unknown as EmailService;
}

describe('contact router', () => {
  beforeEach(() => {
    sendContactEmail.mockReset();
    sendContactEmail.mockResolvedValue(undefined);
  });

  it('sends contact submissions to the configured Scouty recipient', async () => {
    const config = createConfig();
    const app = createApp(createEmailServiceStub(), config);

    const csrfResponse = await request(app)
      .get('/api/contact/csrf')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca');

    expect(csrfResponse.status).toBe(200);

    const submitResponse = await request(app)
      .post('/api/contact')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca')
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .send({
        name: 'Ada Lovelace',
        email: 'visitor@example.com',
        subject: 'Contact form test',
        message: 'Please help me with Scouty.',
        website: '',
      });

    expect(submitResponse.status).toBe(202);
    expect(submitResponse.headers['x-correlation-id']).toMatch(/^[a-f0-9]{24}$/);
    expect(sendContactEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'contact@example.com',
      senderName: 'Ada Lovelace',
      senderEmail: 'visitor@example.com',
      subject: 'Contact form test',
      message: 'Please help me with Scouty.',
      correlationId: submitResponse.headers['x-correlation-id'],
    }));
  });

  it('rejects subject header injection attempts', async () => {
    const config = createConfig();
    const app = createApp(createEmailServiceStub(), config);

    const csrfResponse = await request(app)
      .get('/api/contact/csrf')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca');

    const submitResponse = await request(app)
      .post('/api/contact')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca')
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .send({
        name: 'Ada Lovelace',
        email: 'visitor@example.com',
        subject: 'Hello\r\nBcc: attacker@example.com',
        message: 'Please help me with Scouty.',
        website: '',
      });

    expect(submitResponse.status).toBe(400);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('treats honeypot submissions as accepted without sending mail', async () => {
    const config = createConfig();
    const app = createApp(createEmailServiceStub(), config);

    const csrfResponse = await request(app)
      .get('/api/contact/csrf')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca');

    const submitResponse = await request(app)
      .post('/api/contact')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca')
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .send({
        name: 'Ada Lovelace',
        email: 'visitor@example.com',
        subject: 'Contact form test',
        message: 'Please help me with Scouty.',
        website: 'https://malicious.example.com',
      });

    expect(submitResponse.status).toBe(202);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('blocks requests from a mismatched origin', async () => {
    const config = createConfig();
    const app = createApp(createEmailServiceStub(), config);

    const csrfResponse = await request(app)
      .get('/api/contact/csrf')
      .set('Origin', config.frontendOrigin ?? 'https://app.scouty.ca');

    const submitResponse = await request(app)
      .post('/api/contact')
      .set('Origin', 'https://evil.example.com')
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .send({
        name: 'Ada Lovelace',
        email: 'visitor@example.com',
        subject: 'Contact form test',
        message: 'Please help me with Scouty.',
        website: '',
      });

    expect(submitResponse.status).toBe(403);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });
});