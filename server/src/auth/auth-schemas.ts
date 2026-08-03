import { z } from 'zod';

const emailSchema = z.string().trim().email('Enter a valid email address').max(254);
const passwordSchema = z.string().min(12, 'Password must be at least 12 characters long').max(256);
const tokenSchema = z.string().trim().min(32).max(512);

export const registerSchema = z.object({
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
