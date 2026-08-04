export function toSafeAuthActionMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes('already exists')) {
    return 'An account already exists for that email. Try logging in or resetting your password.';
  }

  if (message.includes('Invalid email or password')) {
    return 'Email or password did not match. Try again or reset your password.';
  }

  if (message.includes('Unable to send verification email')) {
    return 'We could not send a verification email right now. Please try again in a moment.';
  }

  if (message.includes('Unable to send password reset email')) {
    return 'We could not send reset instructions right now. Please try again in a moment.';
  }

  if (message.includes('Verification token is invalid or expired')) {
    return 'That verification link is invalid or has expired.';
  }

  if (message.includes('Password reset token is invalid or expired')) {
    return 'That reset link is invalid, expired, or has already been used.';
  }

  return message || fallback;
}