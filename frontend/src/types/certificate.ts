export type CertificateStatus = 'issued' | 'revoked';

export interface Certificate {
  id: string;
  enrollment_id: string;
  number: string;
  issued_on: string;
  mention: string | null;
  status: CertificateStatus;
  revoked_reason: string | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
  enrollment?: {
    id: string;
    learner?: { id: string; first_name: string; last_name: string; name?: string };
    course?: { id: string; name: string };
  };
}

export interface CertificatePayload {
  enrollment_id: string;
  mention?: string;
}
