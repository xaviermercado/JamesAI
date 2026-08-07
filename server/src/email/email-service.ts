import nodemailer from 'nodemailer';

import type { AppConfig } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
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
      replyTo: message.replyTo,
    });
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
}

export interface PasswordResetEmailPayload {
  to: string;
  resetUrl: string;
}

export interface EmailService {
  sendVerificationEmail(payload: AccountEmailPayload): Promise<void>;
  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void>;
  sendContactEmail?(payload: { to: string; senderName: string; senderEmail: string; subject: string; message: string }): Promise<void>;
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
          subject: 'Verify your Scouty.ca account',
          text: [
            'Your Scouty.ca account is ready to verify.',
            `Open this link to verify it: ${payload.verificationUrl}`,
            'If you did not create this account, you can ignore this email.',
          ].join('\n\n'),
          html: `<p>Your Scouty.ca account is ready to verify.</p><p><a href="${payload.verificationUrl}">Verify your email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
        });
      } catch (error) {
        throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
      }
    },

    async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
      try {
        await transport.send({
          to: payload.to,
          subject: 'Reset your Scouty.ca password',
          text: [
            'We received a password reset request for your Scouty.ca account.',
            `Use this link to reset your password: ${payload.resetUrl}`,
            'If you did not request a reset, you can ignore this email.',
          ].join('\n\n'),
          html: `<p>We received a password reset request for your Scouty.ca account.</p><p><a href="${payload.resetUrl}">Reset your password</a></p><p>If you did not request a reset, you can ignore this email.</p>`,
        });
      } catch (error) {
        throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
      }
    },

    async sendContactEmail(payload: { to: string; senderName: string; senderEmail: string; subject: string; message: string }): Promise<void> {
      try {
        const safeName = escapeHtml(payload.senderName);
        const safeEmail = escapeHtml(payload.senderEmail);
        const safeMessage = escapeHtml(payload.message);

        await transport.send({
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
        });
      } catch (error) {
        throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
      }
    },
  };
}
