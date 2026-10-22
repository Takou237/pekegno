import { client } from './client';
import type {
  Paginated,
  Course,
  CoursePayload,
  CourseListParams,
  CoursePromotion,
  CoursePromotionPayload,
  CoursePromotionType,
  Trainer,
  TrainerPayload,
  TrainerCandidate,
  TrainerCandidatesResult,
  EnrollmentStatus,
  Learner,
  SessionStatus,
  TrainingSession,
  SessionPayload,
  TrainerSessionItem,
  TrainerStats,
  LearnerEnrollmentItem,
  LearnerStats,
  CourseProgressItem,
  CourseModule,
  CourseModulePayload,
  FormationEnrollment,
  FormationEnrollmentPayload,
  LearnerObservation as LearnerObservationItem,
  SellerProfile,
} from '@/types/formation';

export type {
  Paginated,
  Course,
  CoursePayload,
  CourseListParams,
  CoursePromotion,
  CoursePromotionPayload,
  CoursePromotionType,
  Trainer,
  TrainerPayload,
  TrainerCandidate,
  TrainerCandidatesResult,
  EnrollmentStatus,
  Learner,
  SessionStatus,
  TrainingSession,
  SessionPayload,
  TrainerSessionItem,
  TrainerStats,
  LearnerEnrollmentItem,
  LearnerStats,
  CourseProgressItem,
  CourseModule,
  CourseModulePayload,
  FormationEnrollment,
  FormationEnrollmentPayload,
  LearnerObservationItem,
  SellerProfile,
};

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

  /** Pays où cette formation est déployée (pré-coche le sélecteur en modification). */
  async courseDeployments(id: string): Promise<string[]> {
    const { data } = await client.get<{ country_ids: string[] }>(`/courses/${id}/deployments`);
    return data.country_ids;
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

  /** Personnes assignables à une session : comptes internes + profils externes. */
  async trainerCandidates(
    params: { agency_id?: string; search?: string; role?: string; per_page?: number } = {},
  ): Promise<TrainerCandidatesResult> {
    const { data } = await client.get<TrainerCandidatesResult>('/trainers/candidates', { params });
    return data;
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

  async learners(params: { agency_id?: string; status?: string; search?: string; course_id?: string; session_id?: string; per_page?: number; page?: number } = {}): Promise<Paginated<Learner>> {
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

  async myTrainerStats(): Promise<TrainerStats> {
    const { data } = await client.get<TrainerStats>('/trainers/me/stats');
    return data;
  },

  async updateLearner(
    learnerId: string,
    payload: {
      first_name?: string;
      last_name?: string;
      email?: string | null;
      phone?: string | null;
      country?: string | null;
      city?: string | null;
      nationality?: string | null;
      address?: string | null;
      quartier?: string | null;
      occupation?: string | null;
      is_active?: boolean;
    },
  ): Promise<LearnerStats['learner']> {
    const { data } = await client.put<{ data: LearnerStats['learner'] & { created_at?: string | null } }>(
      `/learners/${learnerId}`,
      payload,
    );
    return data.data ?? (data as unknown as LearnerStats['learner']);
  },

  async learnerStats(learnerId: string, courseId?: string): Promise<LearnerStats> {
    const { data } = await client.get<LearnerStats>(`/learners/${learnerId}/stats`, {
      params: { course_id: courseId || undefined },
    });
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

  async createFormationEnrollmentWithProof(
    payload: FormationEnrollmentPayload,
    proofFile: File,
    paymentType?: string,
  ): Promise<FormationEnrollment> {
    const formData = new FormData();
    formData.append('proof_file', proofFile);
    const append = (key: string, value: unknown) => {
      if (value === undefined || value === null) return;
      formData.append(key, String(value));
    };
    append('course_id', payload.course_id);
    append('learner_user_id', payload.learner_user_id);
    append('invoice_id', payload.invoice_id);
    append('seller_user_id', payload.seller_user_id);
    append('seller_trainer_id', payload.seller_trainer_id);
    append('training_session_id', payload.training_session_id);
    append('amount_paid', payload.amount_paid);
    append('status', payload.status);
    append('notes', payload.notes);
    append('discount_type', payload.discount_type);
    append('discount_value', payload.discount_value);
    append('payment_type', paymentType);
    const { data } = await client.post<FormationEnrollment>('/formation-enrollments', formData);
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
