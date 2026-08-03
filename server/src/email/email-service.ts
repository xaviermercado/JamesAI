import nodemailer from 'nodemailer';

import type { AppConfig } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(message = 'Unable to send email') {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    console.info(`[EMAIL] ${message.subject} -> ${message.to}`);
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
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export interface AccountEmailPayload {
  to: string;
  verificationUrl: string;
}

export interface PasswordResetEmailPayload {
  to: string;
  resetUrl: string;
}

export interface EmailService {
  sendVerificationEmail(payload: AccountEmailPayload): Promise<void>;
  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void>;
}

export function createEmailService(config: AppConfig): EmailService {
  const transport = config.emailProvider === 'smtp'
    ? new SmtpEmailTransport(config)
    : new ConsoleEmailTransport();

  return {
    async sendVerificationEmail(payload: AccountEmailPayload): Promise<void> {
      try {
        await transport.send({
          to: payload.to,
          subject: 'Verify your JamesAI account',
          text: [
            'Your JamesAI account is ready to verify.',
            `Open this link to verify it: ${payload.verificationUrl}`,
            'If you did not create this account, you can ignore this email.',
          ].join('\n\n'),
          html: `<p>Your JamesAI account is ready to verify.</p><p><a href="${payload.verificationUrl}">Verify your email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
        });
      } catch (error) {
        throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
      }
    },

    async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
      try {
        await transport.send({
          to: payload.to,
          subject: 'Reset your JamesAI password',
          text: [
            'We received a password reset request for your JamesAI account.',
            `Use this link to reset your password: ${payload.resetUrl}`,
            'If you did not request a reset, you can ignore this email.',
          ].join('\n\n'),
          html: `<p>We received a password reset request for your JamesAI account.</p><p><a href="${payload.resetUrl}">Reset your password</a></p><p>If you did not request a reset, you can ignore this email.</p>`,
        });
      } catch (error) {
        throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
      }
    },
  };
}
