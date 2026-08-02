/**
 * Reflète app/Models/User.php + app/Models/Role.php (Dev1).
 * Contrat vérifié contre le code réel du backend (juillet 2026).
 */
export interface Role {
  id: string;
  name: string; // 'super-admin' | 'direction-generale' | 'responsable-agence' | ...
  description: string | null;
}

export interface UserAssignmentPivot {
  department_id: string | null;
  is_primary: boolean;
  is_department_chief: boolean;
}

export interface UserAssignment {
  id: string;
  name: string;
  pivot: UserAssignmentPivot;
}

export interface User {
  id: string; // uuid
  username: string;
  name: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role_id: string | null;
  role: Role | null;
  is_active: boolean;
  two_factor_enabled: boolean;
  is_password_change_required: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  assignments?: UserAssignment[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Réponse "succès direct" de POST /auth/login. */
export interface AuthSuccessResponse {
  user: User;
  token: string;
}

/**
 * Réponse "défi 2FA" réelle de POST /auth/login (AuthService::attempt),
 * lorsque l'utilisateur a two_factor_enabled = true.
 */
export interface AuthTwoFactorChallengeResponse {
  two_factor_required: true;
  temp_token: string;
}

export type LoginResponse = AuthSuccessResponse | AuthTwoFactorChallengeResponse;

export function requiresTwoFactor(
  response: LoginResponse
): response is AuthTwoFactorChallengeResponse {
  return (response as AuthTwoFactorChallengeResponse).two_factor_required === true;
}

export interface TwoFactorLoginPayload {
  temp_token: string;
  code: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface DeleteAccountPayload {
  password: string;
}

export interface TwoFactorEnableResponse {
  secret: string;
  qr_code_url: string;
}

export interface ApiMessageResponse {
  message: string;
}

export interface ApiValidationError {
  message: string;
  errors?: Record<string, string[]>;
}
