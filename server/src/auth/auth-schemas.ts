import { z } from 'zod';

const emailSchema = z.string().trim().email('Enter a valid email address').max(254);
const passwordSchema = z.string().min(12, 'Password must be at least 12 characters long').max(256);
const tokenSchema = z.string().trim().min(32).max(512);
const humanNameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(80, 'Must be 80 characters or fewer')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*[\p{L}\p{M}]$|^[\p{L}\p{M}]$/u, 'Use letters, spaces, apostrophes, or hyphens only');

export const registerSchema = z.object({
  firstName: humanNameSchema.optional(),
  lastName: humanNameSchema.optional(),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = registerSchema;

export const emailOnlySchema = z.object({
  email: emailSchema,
});

export const verifyEmailSchema = z.object({
  token: tokenSchema,
});

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});
