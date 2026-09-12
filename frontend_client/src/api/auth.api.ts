import { client } from './client';
import type { LoginResponse, User } from '@/types';

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

  async resetPassword(payload: { token: string; email: string; password: string; password_confirmation: string }): Promise<{ message: string }> {
    const { data } = await client.post<{ message: string }>('/auth/reset-password', payload);
    return data;
  },

  async updateProfile(payload: { first_name: string; last_name: string; phone?: string; city?: string; country?: string; address?: string }): Promise<User> {
    const { data } = await client.put<User>('/client/me', payload);
    return data;
  },

  async changePassword(payload: { current_password: string; password: string; password_confirmation: string }): Promise<{ message: string }> {
    const { data } = await client.put<{ message: string }>('/auth/change-password', payload);
    return data;
  },
};
