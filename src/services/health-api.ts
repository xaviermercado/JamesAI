const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export interface HealthStatus {
  status: 'ok' | 'error';
  message: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      return { status: 'error', message: 'Backend unavailable' };
    }

    const payload = (await response.json().catch(() => ({}))) as { status?: string };
    return {
      status: payload.status === 'ok' ? 'ok' : 'error',
      message: payload.status === 'ok' ? 'Backend online' : 'Backend unavailable',
    };
  } catch {
    return { status: 'error', message: 'Backend unavailable' };
  }
}
