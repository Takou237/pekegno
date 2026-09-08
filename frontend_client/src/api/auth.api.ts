import { client } from './client';
import type { LoginResponse } from '@/types';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await client.post<LoginResponse>('/client/login', { email, password });
    return data;
  },

  async register(payload: { first_name: string; last_name: string; email: string; password: string; password_confirmation: string; phone?: string; city?: string; country?: string }): Promise<{ message: string }> {
    const { data } = await client.post<{ message: string }>('/client/register', payload);
    return data;
  },

  async me() {
    const { data } = await client.get('/client/me');
    return data;
  },

  async logout(): Promise<void> {
    await client.post('/client/logout');
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const { data } = await client.post('/auth/forgot-password', { email });
    return data;
  },
};
