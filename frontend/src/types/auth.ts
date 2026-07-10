/**
 * Reflète app/Models/User.php (Dev1) — garder synchronisé avec le backend.
 */
export interface User {
  id: string; // uuid
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  two_factor_enabled: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

/**
 * Réponse "succès direct" de POST /auth/login (utilisateur sans 2FA activé).
 */
export interface AuthSuccessResponse {
  user: User;
  token: string;
}

/**
 * Réponse "défi 2FA" attendue de POST /auth/login lorsque l'utilisateur a
 * two_factor_enabled = true.
 *
 * ⚠️ CONTRAT À CONFIRMER AVEC DEV1 : son LoginController actuel renvoie
 * toujours { user, token } sans jamais vérifier two_factor_enabled, et
 * aucune route /auth/two-factor/verify n'existe encore côté API.
 * Le shape ci-dessous est celui qu'on propose pour ne pas bloquer le front —
 * à ajuster dès que Dev1 code le TwoFactorController.
 */
export interface AuthTwoFactorChallengeResponse {
  requires_two_factor: true;
  two_factor_token: string;
}

export type LoginResponse = AuthSuccessResponse | AuthTwoFactorChallengeResponse;

export function requiresTwoFactor(
  response: LoginResponse
): response is AuthTwoFactorChallengeResponse {
  return (response as AuthTwoFactorChallengeResponse).requires_two_factor === true;
}

export interface TwoFactorVerifyPayload {
  two_factor_token: string;
  code: string;
}

export interface ApiValidationError {
  message: string;
  errors?: Record<string, string[]>;
}
