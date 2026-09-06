import { client } from './client';
import type { CourseModule, CourseModulePayload, FormationEnrollment, FormationEnrollmentPayload, LearnerObservation as LearnerObservationItem, SellerProfile } from '@/types/formation';

export type { CourseModule, CourseModulePayload, FormationEnrollment, FormationEnrollmentPayload, LearnerObservationItem, SellerProfile };

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
  availability: 'agency' | 'global';
  is_active: boolean;
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
}

export interface CourseListParams {
  agency_id?: string;
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
  /** Compte utilisateur lié : null si le formateur n'utilise pas la plateforme. */
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
  agency_id?: string | null;
  start_at: string;
  end_at?: string | null;
  max_capacity?: number | null;
  price?: number | null;
  status?: SessionStatus;
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

export const academyApi = {
  async courses(params: CourseListParams = {}): Promise<Paginated<Course>> {
    const { data } = await client.get<Paginated<Course>>('/courses', { params });
    return data;
  },

  async getCourse(id: string): Promise<Course> {
    const { data } = await client.get<{ data: Course }>(`/courses/${id}`);
    return (data as { data?: Course }).data ?? (data as unknown as Course);
  },

  async createCourse(payload: CoursePayload): Promise<Course> {
    const { data } = await client.post<{ data: Course }>('/courses', payload);
    return data.data ?? (data as unknown as Course);
  },

  async updateCourse(id: string, payload: Partial<CoursePayload>): Promise<Course> {
    const { data } = await client.put<{ data: Course }>(`/courses/${id}`, payload);
    return data.data ?? (data as unknown as Course);
  },

  async removeCourse(id: string): Promise<void> {
    await client.delete(`/courses/${id}`);
  },

  async trainers(
    params: { agency_id?: string; search?: string; is_active?: boolean; per_page?: number; page?: number } = {},
  ): Promise<Paginated<Trainer>> {
    const { data } = await client.get<Paginated<Trainer>>('/trainers', { params });
    return data;
  },

  async createTrainer(payload: TrainerPayload): Promise<Trainer> {
    const { data } = await client.post<{ data: Trainer }>('/trainers', payload);
    return data.data ?? (data as unknown as Trainer);
  },

  async updateTrainer(id: string, payload: Partial<TrainerPayload>): Promise<Trainer> {
    const { data } = await client.put<{ data: Trainer }>(`/trainers/${id}`, payload);
    return data.data ?? (data as unknown as Trainer);
  },

  async removeTrainer(id: string): Promise<void> {
    await client.delete(`/trainers/${id}`);
  },

  async availableUsers(params: { agency_id?: string } = {}): Promise<
    { id: string; first_name: string | null; last_name: string | null; email: string; is_active: boolean }[]
  > {
    const { data } = await client.get('/trainers/available-users', { params });
    return Array.isArray(data) ? data : [];
  },

  async linkTrainerUser(trainerId: string, userId: string): Promise<Trainer> {
    const { data } = await client.post<{ data: Trainer }>(`/trainers/${trainerId}/link-user`, {
      user_id: userId,
    });
    return data.data ?? (data as unknown as Trainer);
  },

  async learners(params: { agency_id?: string; status?: string; search?: string; per_page?: number; page?: number } = {}): Promise<Paginated<Learner>> {
    const { data } = await client.get<Paginated<Learner>>('/learners', { params });
    return data;
  },

  async sessions(
    params: { agency_id?: string; course_id?: string; status?: string; per_page?: number; page?: number } = {},
  ): Promise<Paginated<TrainingSession>> {
    const { data } = await client.get<Paginated<TrainingSession>>('/training-sessions', { params });
    return data;
  },

  async createSession(payload: SessionPayload): Promise<TrainingSession> {
    const { data } = await client.post<{ data: TrainingSession }>('/training-sessions', payload);
    return data.data ?? (data as unknown as TrainingSession);
  },

  async updateSession(id: string, payload: Partial<SessionPayload>): Promise<TrainingSession> {
    const { data } = await client.put<{ data: TrainingSession }>(`/training-sessions/${id}`, payload);
    return data.data ?? (data as unknown as TrainingSession);
  },

  async removeSession(id: string): Promise<void> {
    await client.delete(`/training-sessions/${id}`);
  },

  async trainerStats(trainerId: string): Promise<TrainerStats> {
    const { data } = await client.get<TrainerStats>(`/trainers/${trainerId}/stats`);
    return data;
  },

  async learnerStats(learnerId: string): Promise<LearnerStats> {
    const { data } = await client.get<LearnerStats>(`/learners/${learnerId}/stats`);
    return data;
  },

  // === Modules ===
  async modules(courseId: string): Promise<CourseModule[]> {
    const { data } = await client.get<CourseModule[]>(`/courses/${courseId}/modules`);
    return data;
  },

  async createModule(courseId: string, payload: CourseModulePayload): Promise<CourseModule> {
    const { data } = await client.post<CourseModule>(`/courses/${courseId}/modules`, payload);
    return data;
  },

  async updateModule(courseId: string, moduleId: string, payload: Partial<CourseModulePayload>): Promise<CourseModule> {
    const { data } = await client.put<CourseModule>(`/courses/${courseId}/modules/${moduleId}`, payload);
    return data;
  },

  async removeModule(courseId: string, moduleId: string): Promise<void> {
    await client.delete(`/courses/${courseId}/modules/${moduleId}`);
  },

  async reorderModules(courseId: string, order: string[]): Promise<CourseModule[]> {
    const { data } = await client.put<CourseModule[]>(`/courses/${courseId}/modules/reorder`, { order });
    return data;
  },

  // === Formation Enrollments ===
  async formationEnrollments(params: { course_id?: string; agency_id?: string; status?: string; per_page?: number; page?: number } = {}): Promise<Paginated<FormationEnrollment>> {
    const { data } = await client.get<Paginated<FormationEnrollment>>('/formation-enrollments', { params });
    return data;
  },

  async createFormationEnrollment(payload: FormationEnrollmentPayload): Promise<FormationEnrollment> {
    const { data } = await client.post<FormationEnrollment>('/formation-enrollments', payload);
    return data;
  },

  async updateFormationEnrollment(id: string, payload: Partial<FormationEnrollmentPayload>): Promise<FormationEnrollment> {
    const { data } = await client.put<FormationEnrollment>(`/formation-enrollments/${id}`, payload);
    return data;
  },

  async removeFormationEnrollment(id: string): Promise<void> {
    await client.delete(`/formation-enrollments/${id}`);
  },

  async courseLearners(courseId: string): Promise<FormationEnrollment[]> {
    const { data } = await client.get<FormationEnrollment[]>(`/courses/${courseId}/learners`);
    return data;
  },

  // === Formation Promotions ===
  async createFormationPromotion(courseId: string, payload: CoursePromotionPayload): Promise<CoursePromotion> {
    const { data } = await client.post<{ data: CoursePromotion }>(`/courses/${courseId}/promotions`, payload);
    return data.data ?? (data as unknown as CoursePromotion);
  },

  // === Learner Observations ===
  async learnerObservations(params: { learner_user_id?: string; course_id?: string; per_page?: number; page?: number } = {}): Promise<Paginated<LearnerObservationItem>> {
    const { data } = await client.get<Paginated<LearnerObservationItem>>('/learner-observations', { params });
    return data;
  },

  async createLearnerObservation(payload: { learner_user_id: string; course_id?: string; session_id?: string; content: string }): Promise<LearnerObservationItem> {
    const { data } = await client.post<LearnerObservationItem>('/learner-observations', payload);
    return data;
  },

  async removeLearnerObservation(id: string): Promise<void> {
    await client.delete(`/learner-observations/${id}`);
  },
};
