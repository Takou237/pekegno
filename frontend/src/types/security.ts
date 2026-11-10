export interface SecuritySession {
  id: string;
  token_name: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string | null;
  };
  created_at: string | null;
  last_used_at: string | null;
}

export interface SecurityAccount {
  id: string;
  name: string;
  email: string;
  role: string | null;
  is_active: boolean;
  two_factor_enabled: boolean;
  two_factor_channel: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
}

export interface SecurityEvent {
  id: string;
  action: string;
  description: string | null;
  user: { id: string; name: string; email: string } | null;
  ip_address: string | null;
  created_at: string;
}

export interface SecurityCenter {
  environment: {
    app_env: string;
    debug: boolean;
    staging: boolean;
  };
  sessions: SecuritySession[];
  privileged_accounts: SecurityAccount[];
  developer_access: Array<{ email: string; user: SecurityAccount | null }>;
  recent_events: SecurityEvent[];
  alerts: string[];
}
