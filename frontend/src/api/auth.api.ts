import { client } from './client';
import type {
  AuthSuccessResponse,
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  TwoFactorVerifyPayload,
} from '@/types/auth';

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const { data } = await client.post<LoginResponse>('/auth/login', credentials);
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthSuccessResponse> {
    const { data } = await client.post<AuthSuccessResponse>('/auth/register', payload);
    return data;
  },

  /**
   * ⚠️ Endpoint pas encore implémenté côté Dev1 (voir types/auth.ts).
   * Prévu : POST /auth/two-factor/verify -> { user, token }
   */
  async verifyTwoFactor(payload: TwoFactorVerifyPayload): Promise<AuthSuccessResponse> {
    const { data } = await client.post<AuthSuccessResponse>(
      '/auth/two-factor/verify',
      payload
    );
    return data;
  },

  async logout(): Promise<void> {
    await client.post('/auth/logout');
  },

  async me(): Promise<AuthSuccessResponse['user']> {
    const { data } = await client.get<AuthSuccessResponse['user']>('/user');
    return data;
  },
};
