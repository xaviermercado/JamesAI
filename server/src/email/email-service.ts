import { randomUUID } from 'node:crypto';

import nodemailer from 'nodemailer';

import type { AppConfig } from '../config/env';
import { logger } from '../utils/logger';

export interface EmailMessage {
  flow: 'verification' | 'password_reset' | 'contact';
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  correlationId?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(
    message = 'Unable to send email',
    public readonly deliveryState: 'temporary' | 'permanent' | 'unknown' = 'unknown',
    public readonly providerCode?: string,
    public readonly responseCode?: number,
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

function extractEmailAddress(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  return (angleMatch?.[1] ?? trimmed).trim() || undefined;
}

function extractEmailDomain(value?: string): string | undefined {
  const emailAddress = extractEmailAddress(value);
  return emailAddress?.split('@')[1]?.toLowerCase();
}

function isRetryableProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorWithCode = error as Error & { code?: string; responseCode?: number };
  const retryableCodes = new Set(['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'ENOTFOUND', 'EAI_AGAIN']);

  if (typeof errorWithCode.responseCode === 'number') {
    return errorWithCode.responseCode >= 400 && errorWithCode.responseCode < 500;
  }

  return Boolean(errorWithCode.code && retryableCodes.has(errorWithCode.code));
}

function classifyDeliveryError(error: unknown): EmailDeliveryError {
  if (error instanceof EmailDeliveryError) {
    return error;
  }

  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string; responseCode?: number };
    const responseCode = typeof errorWithCode.responseCode === 'number' ? errorWithCode.responseCode : undefined;
    const deliveryState = responseCode
      ? (responseCode >= 500 ? 'permanent' : 'temporary')
      : (isRetryableProviderError(error) ? 'temporary' : 'unknown');

    return new EmailDeliveryError(error.message, deliveryState, errorWithCode.code, responseCode);
  }

  return new EmailDeliveryError(undefined, 'unknown');
}

class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    logger.info('mail.console_accepted', {
      flow: message.flow,
      correlationId: message.correlationId ?? null,
      subject: message.subject,
      recipientDomain: extractEmailDomain(message.to) ?? 'unknown',
    });
  }
}

class SmtpEmailTransport implements EmailTransport {
  private readonly transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: this.config.emailHost,
      port: this.config.emailPort,
      secure: this.config.emailSecure ?? false,
      auth: {
        user: this.config.emailUser,
        pass: this.config.emailApiKey,
      },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    const envelopeFrom = extractEmailAddress(this.config.emailUser) ?? extractEmailAddress(this.config.emailFrom);

    const deliver = async (): Promise<void> => {
      const info = await this.transporter.sendMail({
        from: this.config.emailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        envelope: envelopeFrom
          ? { from: envelopeFrom, to: message.to }
          : undefined,
      });

      const responseCode = (info as { responseCode?: number }).responseCode;

      if (Array.isArray(info.rejected) && info.rejected.length > 0) {
        throw new EmailDeliveryError('Mail provider rejected the recipient', 'permanent', undefined, responseCode);
      }

      logger.info('mail.smtp_accepted', {
        flow: message.flow,
        correlationId: message.correlationId ?? null,
        messageId: info.messageId ?? null,
        recipientDomain: extractEmailDomain(message.to) ?? 'unknown',
      });
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await deliver();
        return;
      } catch (error) {
        const deliveryError = classifyDeliveryError(error);
        if (attempt === 0 && deliveryError.deliveryState === 'temporary') {
          continue;
        }

        throw deliveryError;
      }
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface AccountEmailPayload {
  to: string;
  verificationUrl: string;
  correlationId?: string;
}

export interface PasswordResetEmailPayload {
  to: string;
  resetUrl: string;
  correlationId?: string;
}

export interface EmailService {
  sendVerificationEmail(payload: AccountEmailPayload): Promise<void>;
  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void>;
  sendContactEmail?(payload: { to: string; senderName: string; senderEmail: string; subject: string; message: string; correlationId?: string }): Promise<void>;
}

export function createEmailService(config: AppConfig): EmailService {
  const transport = config.emailProvider === 'smtp'
    ? new SmtpEmailTransport(config)
    : new ConsoleEmailTransport();

  function generateCorrelationId(provided?: string): string {
    return provided ?? randomUUID();
  }

  return {
    async sendVerificationEmail(payload: AccountEmailPayload): Promise<void> {
      try {
        await transport.send({
          flow: 'verification',
          to: payload.to,
          subject: 'Verify your Scouty.ca account',
          text: [
            'Your Scouty.ca account is ready to verify.',
            `Open this link to verify it: ${payload.verificationUrl}`,
            'If you did not create this account, you can ignore this email.',
          ].join('\n\n'),
          html: `<p>Your Scouty.ca account is ready to verify.</p><p><a href="${payload.verificationUrl}">Verify your email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
          correlationId: generateCorrelationId(payload.correlationId),
        });
      } catch (error) {
        throw classifyDeliveryError(error);
      }
    },

    async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
      try {
        await transport.send({
          flow: 'password_reset',
          to: payload.to,
          subject: 'Reset your Scouty.ca password',
          text: [
            'We received a password reset request for your Scouty.ca account.',
            `Use this link to reset your password: ${payload.resetUrl}`,
            'If you did not request a reset, you can ignore this email.',
          ].join('\n\n'),
          html: `<p>We received a password reset request for your Scouty.ca account.</p><p><a href="${payload.resetUrl}">Reset your password</a></p><p>If you did not request a reset, you can ignore this email.</p>`,
          correlationId: generateCorrelationId(payload.correlationId),
        });
      } catch (error) {
        throw classifyDeliveryError(error);
      }
    },

    async sendContactEmail(payload: { to: string; senderName: string; senderEmail: string; subject: string; message: string; correlationId?: string }): Promise<void> {
      try {
        const safeName = escapeHtml(payload.senderName);
        const safeEmail = escapeHtml(payload.senderEmail);
        const safeMessage = escapeHtml(payload.message);

        await transport.send({
          flow: 'contact',
          to: payload.to,
          subject: `Scouty contact: ${payload.subject}`,
          text: [
            'New message from Scouty.ca contact form.',
            `Name: ${payload.senderName}`,
            `Email: ${payload.senderEmail}`,
            '',
            payload.message,
          ].join('\n'),
          html: `<p>New message from Scouty.ca contact form.</p><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Message:</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${safeMessage}</pre>`,
          replyTo: payload.senderEmail,
          correlationId: generateCorrelationId(payload.correlationId),
        });
      } catch (error) {
        throw classifyDeliveryError(error);
      }
    },
  };
}
