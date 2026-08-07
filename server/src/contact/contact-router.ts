import { randomBytes } from 'node:crypto';

import express from 'express';
import rateLimit from 'express-rate-limit';

import { AUTH_CSRF_HEADER_NAME } from '../auth/auth-crypto';
import type { AppConfig } from '../config/env';
import { createEmailService, type EmailService } from '../email/email-service';
import { contactSubmissionSchema } from './contact-schemas';
import { logger } from '../utils/logger';

const CONTACT_RECIPIENT = 'do.not.reply@scout.ca';
const CSRF_TTL_MS = 10 * 60 * 1000;

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin || !config.frontendOrigin) {
    return true;
  }

  return origin === config.frontendOrigin;
}

class ContactCsrfStore {
  private readonly tokens = new Map<string, number>();

  issue(): string {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + CSRF_TTL_MS;
    this.tokens.set(token, expiresAt);
    this.prune();
    return token;
  }

  consume(token: string): boolean {
    const expiresAt = this.tokens.get(token);
    if (!expiresAt || expiresAt < Date.now()) {
      this.tokens.delete(token);
      return false;
    }

    this.tokens.delete(token);
    return true;
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, expiresAt] of this.tokens.entries()) {
      if (expiresAt < now) {
        this.tokens.delete(token);
      }
    }
  }
}

export function createContactRouter(config: AppConfig, emailService: EmailService = createEmailService(config)) {
  const router = express.Router();
  const isProduction = config.nodeEnv === 'production';
  const csrfStore = new ContactCsrfStore();

  const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 8 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.append('Vary', 'Origin');

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  });

  router.get('/csrf', (req, res) => {
    if (!isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const token = csrfStore.issue();
    return res.json({ csrfToken: token });
  });

  router.post('/', submitLimiter, async (req, res) => {
    const csrfToken = req.get(AUTH_CSRF_HEADER_NAME)?.trim();
    if (!csrfToken || !csrfStore.consume(csrfToken)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const parsed = contactSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    if (parsed.data.website) {
      // Honeypot triggered; return a generic accepted response.
      return res.status(202).json({ ok: true });
    }

    const senderName = parsed.data.name;
    const senderEmail = parsed.data.email.trim().toLowerCase();
    const subject = parsed.data.subject.trim();
    const message = parsed.data.message.trim();

    try {
      if (!emailService.sendContactEmail) {
        throw new Error('Contact email handler unavailable');
      }

      await emailService.sendContactEmail({
        to: CONTACT_RECIPIENT,
        senderName,
        senderEmail,
        subject,
        message,
      });
      return res.status(202).json({ ok: true });
    } catch (error) {
      logger.error('contact.route_error', { route: 'POST /api/contact', error });
      return res.status(502).json({ error: 'Unable to send your message right now. Please try again later.' });
    }
  });

  return router;
}
