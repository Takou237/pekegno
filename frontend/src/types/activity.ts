export type ActivityType = 'call' | 'meeting' | 'email' | 'whatsapp' | 'note' | 'followup';

export interface Activity {
  id: string;
  subject_type: string;
  subject_id: string;
  assigned_to: string | null;
  created_by: string | null;
  type: ActivityType;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; first_name: string; last_name: string } | null;
  creator?: { id: string; first_name: string; last_name: string } | null;
}

export interface ActivityPayload {
  subject_type: string;
  subject_id: string;
  assigned_to?: string;
  type: ActivityType;
  title: string;
  notes?: string;
  due_at?: string;
}

export interface ActivityListParams {
  subject_type?: string;
  subject_id?: string;
  type?: ActivityType;
  assigned_to?: string;
  overdue?: boolean;
  completed?: boolean;
  upcoming?: boolean;
  per_page?: number;
}

export interface ActivityListResponse {
  data: Activity[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Appel',
  meeting: 'Rendez-vous',
  email: 'Email',
  whatsapp: 'WhatsApp',
  note: 'Note',
  followup: 'Relance',
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  call: 'Phone',
  meeting: 'Calendar',
  email: 'Mail',
  whatsapp: 'MessageCircle',
  note: 'FileText',
  followup: 'Clock',
};
