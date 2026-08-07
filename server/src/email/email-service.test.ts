import nodemailer from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../config/env';
import { EmailDeliveryError, createEmailService } from './email-service';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

const mockedCreateTransport = vi.mocked(nodemailer.createTransport);

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
    ...overrides,
  };
}

describe('createEmailService', () => {
  beforeEach(() => {
    mockedCreateTransport.mockReset();
  });

  it('uses the Scouty SMTP sender and envelope sender for verification emails', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      accepted: ['user@example.com'],
      rejected: [],
      messageId: 'message-1',
      responseCode: 250,
    });
    mockedCreateTransport.mockReturnValue({ sendMail } as never);

    const service = createEmailService(createConfig());
    await service.sendVerificationEmail({
      to: 'user@example.com',
      verificationUrl: 'https://scouty.ca/verify-email?token=abc123',
      correlationId: 'corr-verification',
    });

    expect(mockedCreateTransport).toHaveBeenCalledWith({
      host: 'mail.scouty.ca',
      port: 465,
      secure: true,
      auth: {
        user: 'do.not.reply@scouty.ca',
        pass: 'smtp-secret',
      },
    });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Scouty <do.not.reply@scouty.ca>',
      to: 'user@example.com',
      replyTo: undefined,
      envelope: {
        from: 'do.not.reply@scouty.ca',
        to: 'user@example.com',
      },
    }));
  });

  it('retries a temporary transport failure once', async () => {
    const temporaryError = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    const sendMail = vi.fn()
      .mockRejectedValueOnce(temporaryError)
      .mockResolvedValueOnce({
        accepted: ['user@example.com'],
        rejected: [],
        messageId: 'message-2',
        responseCode: 250,
      });
    mockedCreateTransport.mockReturnValue({ sendMail } as never);

    const service = createEmailService(createConfig());
    await expect(service.sendPasswordResetEmail({
      to: 'user@example.com',
      resetUrl: 'https://scouty.ca/reset-password?token=abc123',
    })).resolves.toBeUndefined();

    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent provider rejection', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      accepted: [],
      rejected: ['user@example.com'],
      messageId: 'message-3',
      responseCode: 550,
    });
    mockedCreateTransport.mockReturnValue({ sendMail } as never);

    const service = createEmailService(createConfig());

    await expect(service.sendVerificationEmail({
      to: 'user@example.com',
      verificationUrl: 'https://scouty.ca/verify-email?token=abc123',
    })).rejects.toMatchObject({
      name: 'EmailDeliveryError',
      deliveryState: 'permanent',
      responseCode: 550,
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('escapes contact content and preserves reply-to', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      accepted: ['contact@example.com'],
      rejected: [],
      messageId: 'message-4',
      responseCode: 250,
    });
    mockedCreateTransport.mockReturnValue({ sendMail } as never);

    const service = createEmailService(createConfig());
    await expect(service.sendContactEmail!({
      to: 'contact@example.com',
      senderName: '<Ada & Co>',
      senderEmail: 'visitor@example.com',
      subject: 'Need help',
      message: 'Line 1 <script>alert(1)</script>',
    })).resolves.toBeUndefined();

    const sendMailOptions = sendMail.mock.calls[0]?.[0] as { html?: string; text?: string; replyTo?: string };
    expect(sendMailOptions.replyTo).toBe('visitor@example.com');
    expect(sendMailOptions.text).toContain('Line 1 <script>alert(1)</script>');
    expect(sendMailOptions.html).toContain('&lt;Ada &amp; Co&gt;');
    expect(sendMailOptions.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('surfaces provider failures as delivery errors', async () => {
    const sendMail = vi.fn().mockRejectedValue(Object.assign(new Error('auth failed'), { code: 'EAUTH' }));
    mockedCreateTransport.mockReturnValue({ sendMail } as never);

    const service = createEmailService(createConfig());

    await expect(service.sendVerificationEmail({
      to: 'user@example.com',
      verificationUrl: 'https://scouty.ca/verify-email?token=abc123',
    })).rejects.toBeInstanceOf(EmailDeliveryError);

    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});