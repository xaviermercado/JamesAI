import { describe, expect, it } from 'vitest';

import { signupFormSchema } from './validation';

describe('signupFormSchema', () => {
  it('accepts international first and last names', () => {
    const parsed = signupFormSchema.safeParse({
      firstName: 'José',
      lastName: 'Díaz-López',
      email: 'jose@example.com',
      password: 'password-password',
      confirmPassword: 'password-password',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const parsed = signupFormSchema.safeParse({
      firstName: 'Ana',
      lastName: 'O\'Brien',
      email: 'ana@example.com',
      password: 'password-password',
      confirmPassword: 'password-password-2',
    });

    expect(parsed.success).toBe(false);
  });
});