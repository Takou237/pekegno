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

export type EnrollmentDiscountType = 'amount' | 'percent';

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
  discount_type: EnrollmentDiscountType | null;
  discount_value: string | null;
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
  training_session_id?: string;
  amount_paid?: number;
  payment_type?: string;
  status?: 'enrolled' | 'completed' | 'cancelled';
  notes?: string;
  discount_type?: EnrollmentDiscountType;
  discount_value?: number;
}

export interface LearnerObservation {
  id: string;
  learner_user_id: string;
  course_id: string | null;
  session_id: string | null;
  content: string;
  course?: { id: string; name: string } | null;
  session?: { id: string; start_at: string } | null;
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
  employee: 'Employ├®',
};

export const SELLER_KIND_COLORS: Record<string, string> = {
  trainer: 'bg-blue-100 text-blue-700',
  commercial: 'bg-green-100 text-green-700',
  employee: 'bg-purple-100 text-purple-700',
};

export const FORMATION_STATUS_LABELS: Record<string, string> = {
  enrolled: 'Inscrit',
  completed: 'Termin├®',
  cancelled: 'Annul├®',
};

export const FORMATION_STATUS_COLORS: Record<string, string> = {
  enrolled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// --- Types déplacés depuis api/academy.api.ts (source unique de vérité) ---

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  objective: string | null;
  prerequisites: string | null;
  cover_image: string | null;
  presentation_video: string | null;
  promotions?: CoursePromotion[];
  mode: 'online' | 'in_person' | 'mixed';
  categories?: { id: string; name: string; color: string | null }[];
  price: number | null;
  effective_price?: number | null;
  duration_hours: number | null;
  duration_type: 'limited' | 'unlimited';
  duration_months: number | null;
  agency?: { id: string; name: string; code: string } | null;
  agency_id?: string | null;
  availability: 'agency' | 'global';
  is_active: boolean;
  is_public: boolean;
  sessions_count?: number;
  modules_count?: number;
  formation_enrollments_count?: number;
  created_at: string;
  updated_at: string;
}

export type CoursePromotionType = 'amount' | 'percent';

export interface CoursePromotion {
  id: string;
  formation_id: string | null;
  service_id: string | null;
  type: CoursePromotionType;
  promo_price: string | null;
  discount_percent: string | null;
  effective_price: number | string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at?: string;
}

export interface CoursePromotionPayload {
  type: CoursePromotionType;
  promo_price?: string | number | null;
  discount_percent?: string | number | null;
  start_date: string;
  end_date: string;
}

export interface CoursePayload {
  name: string;
  code?: string;
  description?: string | null;
  objective?: string | null;
  prerequisites?: string | null;
  cover_image?: string | null;
  presentation_video?: string | null;
  mode?: Course['mode'];
  price?: number | null;
  duration_hours?: number | null;
  duration_type?: 'limited' | 'unlimited';
  duration_months?: number | null;
  agency_id?: string | null;
  category_ids?: string[];
  is_active?: boolean;
  is_public?: boolean;
  target_country_ids?: string[];
}

export interface CourseListParams {
  agency_id?: string;
  country_id?: string;
  search?: string;
  per_page?: number;
  page?: number;
  mode?: Course['mode'];
  categories?: string[];
  promotion?: 'active' | 'none';
}

export interface Trainer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  is_active: boolean;
  /** Compte utilisateur li├® : null si le formateur n'utilise pas la plateforme. */
  user_id: string | null;
  has_account: boolean;
  agency?: { id: string; name: string; code: string } | null;
  sessions_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TrainerPayload {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  agency_id?: string | null;
  is_active?: boolean;
}

/**
 * Personne assignable à une session : un compte interne (`kind: 'user'`) ou un
 * profil formateur autonome sans compte (`kind: 'profile'`).
 */
export interface TrainerCandidate {
  kind: 'user' | 'profile';
  user_id: string | null;
  trainer_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  agency: { id: string; name: string } | null;
  is_active: boolean;
}

export interface TrainerCandidatesResult {
  data: TrainerCandidate[];
  meta: { roles: string[] };
}

export type EnrollmentStatus = 'enrolled' | 'completed' | 'cancelled';

export interface Learner {
  id: string;
  learner: {
    id: string;
    client_number: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
  };
  status: EnrollmentStatus | null;
  enrollments_count: number;
  primary: {
    source: 'formation' | 'session';
    course_id: string | null;
    course_name: string | null;
    course_code: string | null;
    status: EnrollmentStatus | null;
    date: string | null;
  } | null;
  session: {
    id: string;
    start_at: string | null;
    course?: { id: string; name: string } | null;
  } | null;
}

export type SessionStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';

export interface TrainingSession {
  id: string;
  course?: { id: string; code: string; name: string; mode: Course['mode'] } | null;
  trainer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    user_id?: string | null;
  } | null;
  agency?: { id: string; name: string; code: string } | null;
  start_at: string;
  end_at: string | null;
  max_capacity: number | null;
  price: number | null;
  effective_price?: number | null;
  status: SessionStatus;
  enrollments_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SessionPayload {
  course_id: string;
  trainer_id?: string | null;
  /** Compte interne retenu comme animateur (prioritaire sur `trainer_id`). */
  trainer_user_id?: string | null;
  agency_id?: string | null;
  start_at: string;
  end_at?: string | null;
  max_capacity?: number | null;
  price?: number | null;
  status?: SessionStatus;
  sync_across_agencies?: boolean;
}

export interface TrainerSessionItem {
  id: string;
  course?: { id: string; name: string; code: string } | null;
  agency?: { id: string; name: string } | null;
  start_at: string;
  status: SessionStatus;
  enrollments_count: number;
}

export interface TrainerStats {
  trainer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    bio: string | null;
    is_active: boolean;
    has_account: boolean;
    created_at: string | null;
  };
  stats: {
    seller_profile_id?: string | null;
    seller_profile?: {
      id: string;
      kind: 'trainer' | 'commercial' | 'employee';
      commission_type: 'percent' | 'fixed' | 'none';
      commission_value: number;
      is_active: boolean;
      user?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
    } | null;
    sessions_total: number;
    sessions_by_status: Record<SessionStatus, number>;
    sessions_upcoming: number;
    enrollments_total: number;
    enrollments_enrolled: number;
    enrollments_completed: number;
    enrollments_cancelled: number;
    learners_unique: number;
    attendance_count: number;
    attendance_rate: number;
    completion_rate: number;
    potential_revenue: number;
    hours_taught: number;
    sales_count: number;
    sales_turnover: number;
    formation_sales: {
      count: number;
      turnover: number;
      paid_count: number;
      paid_turnover: number;
    };
    service_sales: {
      count: number;
      turnover: number;
      paid_count: number;
      paid_turnover: number;
    };
    commissions_training: number;
    commissions_service: number;
    commissions_earned: number;
    commissions_paid: number;
    commissions_balance: number;
  };
  recent_formation_sales: {
    id: string;
    course?: { id: string; name: string; code: string } | null;
    learner?: { id: string; first_name: string | null; last_name: string | null } | null;
    date: string | null;
    amount: number;
    invoice_status: string | null;
  }[];
  recent_service_sales: {
    id: string;
    number: string;
    label: string;
    client?: { first_name: string | null; last_name: string | null } | null;
    date: string | null;
    amount: number;
    status: string;
  }[];
  recent_sessions: TrainerSessionItem[];
  upcoming_sessions: TrainerSessionItem[];
  assigned_modules: {
    id: string;
    name: string;
    order_index: number;
    course?: { id: string; name: string; code: string } | null;
  }[];
}

export interface LearnerEnrollmentItem {
  id: string;
  course?: { id: string; name: string; code: string } | null;
  trainer?: string | null;
  start_at: string | null;
  status: EnrollmentStatus;
  attendance: boolean;
}

export interface LearnerStats {
  learner: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    country: string | null;
    city: string | null;
    nationality: string | null;
    address: string | null;
    quartier: string | null;
    occupation: string | null;
    client_number: string | null;
    is_active: boolean;
    created_at: string | null;
  };
  stats: {
    enrollments_total: number;
    enrollments_by_status: Record<EnrollmentStatus, number>;
    courses_unique: number;
    trainers_unique: number;
    sessions_upcoming: number;
    attendance_count: number;
    completion_rate: number;
    total_invested: number;
    hours_completed: number;
    courses_progress: CourseProgressItem[];
  };
  upcoming_sessions: LearnerEnrollmentItem[];
  recent_enrollments: LearnerEnrollmentItem[];
}

export interface CourseProgressItem {
  course_id: string;
  course_name: string;
  course_code: string;
  total_modules: number;
  total_sessions: number;
  completed_sessions: number;
  total_slots: number;
  completed_slots: number;
  progress_percent: number;
}
