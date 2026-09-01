export interface CourseModule {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  order_index: number;
  duration_hours: number | null;
  trainer_id: string | null;
  trainer?: { id: string; first_name: string; last_name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface CourseModulePayload {
  name: string;
  description?: string;
  order_index?: number;
  duration_hours?: number;
  trainer_id?: string;
}

export interface FormationEnrollment {
  id: string;
  course_id: string;
  learner_user_id: string;
  invoice_id: string | null;
  seller_user_id: string | null;
  seller_trainer_id: string | null;
  enrolled_at: string;
  status: 'enrolled' | 'completed' | 'cancelled';
  notes: string | null;
  amount_paid: number | string | null;
  course?: {
    id: string;
    name: string;
    code: string;
    modules?: CourseModule[];
    price?: number | null;
    effective_price?: number | null;
    sessions_count?: number;
    modules_count?: number;
  };
  learner?: { id: string; first_name: string; last_name: string; email: string; name?: string };
  seller?: { id: string; first_name: string; last_name: string };
  seller_trainer?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  created_at: string;
}

export interface FormationEnrollmentPayload {
  course_id: string;
  learner_user_id: string;
  invoice_id?: string;
  seller_user_id?: string;
  seller_trainer_id?: string;
  status?: 'enrolled' | 'completed' | 'cancelled';
  notes?: string;
  amount_paid?: number;
}

export interface LearnerObservation {
  id: string;
  learner_user_id: string;
  course_id: string | null;
  session_id: string | null;
  content: string;
  course?: { id: string; name: string } | null;
  session?: { id: string; start_at: string } | null;
  learner?: { id: string; first_name: string | null; last_name: string | null; email?: string } | null;
  created_at: string;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  agency_id: string;
  kind: 'trainer' | 'commercial' | 'employee';
  commission_type: 'percent' | 'fixed' | 'none';
  commission_value: number;
  is_active: boolean;
  user?: { id: string; first_name: string; last_name: string; email: string; name?: string };
  created_at: string;
}

export interface SellerProfilePayload {
  user_id: string;
  agency_id: string;
  kind: 'trainer' | 'commercial' | 'employee';
  commission_type: 'percent' | 'fixed' | 'none';
  commission_value: number;
}

export interface CommissionSummary {
  total_training: number;
  total_service: number;
  total_owed: number;
  total_paid: number;
  balance: number;
}

export const SELLER_KIND_LABELS: Record<string, string> = {
  trainer: 'Formateur',
  commercial: 'Commercial',
  employee: 'Employé',
};

export const SELLER_KIND_COLORS: Record<string, string> = {
  trainer: 'bg-blue-100 text-blue-700',
  commercial: 'bg-green-100 text-green-700',
  employee: 'bg-purple-100 text-purple-700',
};

export const FORMATION_STATUS_LABELS: Record<string, string> = {
  enrolled: 'Inscrit',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const FORMATION_STATUS_COLORS: Record<string, string> = {
  enrolled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
