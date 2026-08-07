import { requestJson } from './http-client';

export interface ContactSubmissionInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string;
}

export async function getContactCsrfToken(): Promise<string> {
  const response = await requestJson<{ csrfToken: string }>('/api/contact/csrf', { method: 'GET' });
  return response.csrfToken;
}

export async function submitContactMessage(input: ContactSubmissionInput, csrfToken: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/contact', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ ...input, website: input.website ?? '' }),
  });
}
