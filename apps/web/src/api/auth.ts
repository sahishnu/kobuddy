import { apiJson } from './client.js';

export type MeResponse = { isAdmin: boolean };
type OkResponse = { ok: boolean };

export function fetchMe(): Promise<MeResponse> {
  return apiJson<MeResponse>('/api/auth/me');
}

export function login(password: string): Promise<OkResponse> {
  return apiJson<OkResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function logout(): Promise<OkResponse> {
  return apiJson<OkResponse>('/api/auth/logout', { method: 'POST' });
}
