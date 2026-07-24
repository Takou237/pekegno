import { client } from './client';
import type {
  ApiMessageResponse,
  AuthSuccessResponse,
  ChangePasswordPayload,
  DeleteAccountPayload,
  ForgotPasswordPayload,
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  ResetPasswordPayload,
  TwoFactorEnableResponse,
  TwoFactorLoginPayload,
  User,
} from '@/types/auth';

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const { data } = await client.post<LoginResponse>('/auth/login', credentials);
    return data;
  },

  /** POST /auth/2fa/login — étape de vérification du code TOTP après un login à 2 facteurs. */
  async twoFactorLogin(payload: TwoFactorLoginPayload): Promise<AuthSuccessResponse> {
    const { data } = await client.post<AuthSuccessResponse>('/auth/2fa/login', payload);
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthSuccessResponse> {
    const { data } = await client.post<AuthSuccessResponse>('/auth/register', payload);
    return data;
  },

  async logout(): Promise<void> {
    await client.post('/auth/logout');
  },

  async me(): Promise<User> {
    const { data } = await client.get<User>('/user');
    return data;
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<ApiMessageResponse> {
    const { data } = await client.post<ApiMessageResponse>('/auth/forgot-password', payload);
    return data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<ApiMessageResponse> {
    const { data } = await client.post<ApiMessageResponse>('/auth/reset-password', payload);
    return data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ApiMessageResponse> {
    const { data } = await client.put<ApiMessageResponse>('/auth/change-password', payload);
    return data;
  },

  async deleteAccount(payload: DeleteAccountPayload): Promise<ApiMessageResponse> {
    const { data } = await client.delete<ApiMessageResponse>('/auth/account', { data: payload });
    return data;
  },

  /** POST /auth/2fa/enable — génère le secret + l'URL du QR code (ne l'active pas encore). */
  async enableTwoFactor(): Promise<TwoFactorEnableResponse> {
    const { data } = await client.post<TwoFactorEnableResponse>('/auth/2fa/enable');
    return data;
  },

  /** POST /auth/2fa/verify — confirme le code TOTP et active définitivement la 2FA. */
  async verifyTwoFactorSetup(code: string): Promise<ApiMessageResponse> {
    const { data } = await client.post<ApiMessageResponse>('/auth/2fa/verify', { code });
    return data;
  },

  /** POST /auth/2fa/disable — désactive la 2FA (mot de passe + code requis). */
  async disableTwoFactor(password: string, code: string): Promise<ApiMessageResponse> {
    const { data } = await client.post<ApiMessageResponse>('/auth/2fa/disable', {
      password,
      code,
    });
    return data;
  },
};
