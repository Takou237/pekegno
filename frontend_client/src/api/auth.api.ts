import { client } from './client';
import type { LoginResponse, User } from '@/types';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await client.post<LoginResponse>('/client/login', { email, password });
    return data;
  },

  /** POST /auth/2fa/login — étape code OTP (endpoint partagé staff/clients). */
  async twoFactorLogin(tempToken: string, code: string): Promise<{ user: User; token: string }> {
    const { data } = await client.post<{ user: User; token: string }>('/auth/2fa/login', {
      temp_token: tempToken,
      code,
    });
    return data;
  },

  /** POST /auth/2fa/email/resend — renvoyer un code pendant un défi (partagé). */
  async resendTwoFactorEmailCode(tempToken: string): Promise<{ message: string }> {
    const { data } = await client.post<{ message: string }>('/auth/2fa/email/resend', {
      temp_token: tempToken,
    });
    return data;
  },

  /** POST /client/2fa/enable — active la 2FA email (envoie le premier code). */
  async enableTwoFactor(): Promise<{ channel: string; masked_email: string }> {
    const { data } = await client.post<{ channel: string; masked_email: string }>('/client/2fa/enable');
    return data;
  },

  /** POST /client/2fa/verify — confirme le code reçu et active la 2FA. */
  async verifyTwoFactor(code: string): Promise<{ message: string }> {
    const { data } = await client.post<{ message: string }>('/client/2fa/verify', { code });
    return data;
  },

  /** POST /client/2fa/disable — désactive la 2FA (mot de passe + code). */
  async disableTwoFactor(password: string, code: string): Promise<{ message: string }> {
    const { data } = await client.post<{ message: string }>('/client/2fa/disable', {
      password,
      code,
    });
    return data;
  },

  /** POST /client/2fa/email/send — renvoyer un code (activation / désactivation). */
  async sendTwoFactorEmailCode(): Promise<{ message: string }> {
    const { data } = await client.post<{ message: string }>('/client/2fa/email/send');
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
