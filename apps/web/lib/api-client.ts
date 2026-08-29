/**
 * FrameForge Core API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RequestOptions extends RequestInit {
  json?: unknown;
  token?: string | null;
}

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }

  const token = options.token || (typeof window !== 'undefined' ? localStorage.getItem('frameforge_token') : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null as T;

  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}
