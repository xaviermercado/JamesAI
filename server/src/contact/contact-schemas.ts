import { z } from 'zod';

export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(120).refine((value) => !/[\r\n]/.test(value), 'Invalid subject'),
  message: z.string().trim().min(10).max(4000),
  // Honeypot should stay blank for human users.
  website: z.string().max(0).optional().default(''),
}).strict();

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
