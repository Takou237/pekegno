import { client } from './client';
import type {
  ActionComment,
  ActionLog,
  ActionPayload,
  AgencyCategory,
  AgencyCategoryKind,
  AgencyNotification,
  AgencyPackage,
  AgencyReport,
  ClientTeamRole,
  LaravelPage,
  PackagePayload,
  Prestation,
  PrestationAction,
  PrestationActionExecution,
  PrestationOffer,
  PrestationOfferPayload,
  PrestationPayload,
  RatingSummary,
  Review,
  SubscribePayload,
  TeamMember,
  TeamOverviewRow,
  TrackingRow,
  WeekSummary,
} from '@/types/agencyDepartment';

type Params = Record<string, string | number | boolean | undefined | null>;

const get = <T>(url: string, params?: Params) => client.get<T>(url, { params }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => client.post<T>(url, body).then((r) => r.data);
const put = <T>(url: string, body?: unknown) => client.put<T>(url, body).then((r) => r.data);
const del = (url: string) => client.delete(url).then(() => undefined);

/** API du département Agency (backend : app/Http/Controllers/Api/Agency). */
export const agencyDeptApi = {
  // Catégories (D2)
  categories: (params: { kind?: AgencyCategoryKind; department_id?: string; agency_id?: string; country_id?: string }) =>
    get<{ data: AgencyCategory[] }>('/agency-categories', params).then((r) => r.data),
  createCategory: (payload: Partial<AgencyCategory>) => post<AgencyCategory>('/agency-categories', payload),
  updateCategory: (id: string, payload: Partial<AgencyCategory>) => put<AgencyCategory>(`/agency-categories/${id}`, payload),
  deleteCategory: (id: string) => del(`/agency-categories/${id}`),

  // Packages
  packages: (params: Params) => get<{ data: AgencyPackage[] }>('/packages', params).then((r) => r.data),
  package: (id: string) => get<AgencyPackage>(`/packages/${id}`),
  createPackage: (payload: PackagePayload) => post<AgencyPackage>('/packages', payload),
  updatePackage: (id: string, payload: Partial<PackagePayload>) => put<AgencyPackage>(`/packages/${id}`, payload),
  deletePackage: (id: string) => del(`/packages/${id}`),
  addPromotion: (id: string, payload: { type: 'amount' | 'percent'; promo_price?: number; discount_percent?: number; start_date: string; end_date: string }) =>
    post(`/packages/${id}/promotions`, payload),
  deletePromotion: (id: string, promotionId: string) => del(`/packages/${id}/promotions/${promotionId}`),
  subscribe: (id: string, payload: SubscribePayload) =>
    post<{ contract: { id: string; number: string }; prestation: Prestation; invoice: { id: string; number: string } }>(`/packages/${id}/subscribe`, payload),

  // Offres de prestation (le « produit » à souscrire) → /prestation-offers
  offers: (params: Params) => get<LaravelPage<PrestationOffer>>('/prestation-offers', params),
  offer: (id: string) => get<PrestationOffer>(`/prestation-offers/${id}`),
  createOffer: (payload: PrestationOfferPayload) => post<PrestationOffer>('/prestation-offers', payload),
  updateOffer: (id: string, payload: PrestationOfferPayload) => put<PrestationOffer>(`/prestation-offers/${id}`, payload),
  deleteOffer: (id: string) => del(`/prestation-offers/${id}`),

  // Prestations
  prestations: (params: Params) => get<LaravelPage<Prestation>>('/prestations', params),
  prestation: (id: string) => get<Prestation>(`/prestations/${id}`),
  createPrestation: (payload: PrestationPayload) => post<Prestation>('/prestations', payload),
  updatePrestation: (id: string, payload: PrestationPayload) => put<Prestation>(`/prestations/${id}`, payload),
  deletePrestation: (id: string) => del(`/prestations/${id}`),
  transition: (id: string, action: 'submit' | 'validate' | 'reject' | 'back-to-draft' | 'start' | 'suspend' | 'resume' | 'cancel' | 'complete', reason?: string) =>
    post<Prestation>(`/prestations/${id}/${action}`, reason ? { reason } : {}),
  tracking: (params: Params) => get<LaravelPage<TrackingRow>>('/prestations/tracking', params),
  exportTracking: (params: Params) => client.get('/prestations/tracking/export', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  // Actions (D4)
  actions: (prestationId: string) =>
    get<{ data: PrestationAction[]; budget: { total: number; allocated: number; remaining: number; spent: number } }>(`/prestations/${prestationId}/actions`),
  actionsBoard: (params: Params) =>
    get<LaravelPage<PrestationAction> & { budget: { allocated: number; spent: number; pass_through: number } }>('/prestation-actions/board', params),
  actionDetail: (prestationId: string, actionId: string) =>
    get<{ action: PrestationAction; progress: { done: number; expected: number; percent: number }; weeks: WeekSummary[] }>(`/prestations/${prestationId}/actions/${actionId}`),
  createAction: (prestationId: string, payload: ActionPayload) => post<PrestationAction>(`/prestations/${prestationId}/actions`, payload),
  updateAction: (id: string, payload: ActionPayload) => put<PrestationAction>(`/prestation-actions/${id}`, payload),
  deleteAction: (id: string) => del(`/prestation-actions/${id}`),
  actionStatus: (id: string, status: string, comment?: string) => post<PrestationAction>(`/prestation-actions/${id}/status`, { status, comment }),
  actionComments: (id: string) => get<{ data: ActionComment[] }>(`/prestation-actions/${id}/comments`).then((r) => r.data),
  addActionComment: (id: string, body: string) => post<ActionComment>(`/prestation-actions/${id}/comments`, { body }),
  actionLogs: (id: string) => get<{ data: ActionLog[]; progress: { done: number; expected: number; percent: number } }>(`/prestation-actions/${id}/logs`),
  addActionLog: (id: string, payload: { done_at: string; quantity_done?: number; proof_url?: string; cost?: number; note?: string }) =>
    post<ActionLog>(`/prestation-actions/${id}/logs`, payload),
  actionExecutions: (actionId: string, params?: Params) =>
    get<{ data: PrestationActionExecution[]; weeks: WeekSummary[]; progress: { done: number; expected: number; percent: number } }>(`/prestation-actions/${actionId}/executions`, params),
  createExecution: (actionId: string, payload: Partial<PrestationActionExecution>) => post<PrestationActionExecution>(`/prestation-actions/${actionId}/executions`, payload),
  updateExecution: (executionId: string, payload: Partial<PrestationActionExecution>) => put<PrestationActionExecution>(`/prestation-action-executions/${executionId}`, payload),
  deleteExecution: (executionId: string) => del(`/prestation-action-executions/${executionId}`),

  // Équipe client
  teamRoles: (params: { department_id?: string }) => get<{ data: ClientTeamRole[] }>('/client-team-roles', params).then((r) => r.data),
  createTeamRole: (payload: Partial<ClientTeamRole>) => post<ClientTeamRole>('/client-team-roles', payload),
  updateTeamRole: (id: string, payload: Partial<ClientTeamRole>) => put<ClientTeamRole>(`/client-team-roles/${id}`, payload),
  deleteTeamRole: (id: string) => del(`/client-team-roles/${id}`),
  seedTeamRoles: (department_id: string) => post<{ data: ClientTeamRole[] }>('/client-team-roles/defaults', { department_id }),
  team: (prestationId: string) => get<{ data: TeamMember[] }>(`/prestations/${prestationId}/team`).then((r) => r.data),
  addTeamMember: (prestationId: string, payload: { user_id: string; client_team_role_id?: string | null; is_lead?: boolean }) =>
    post<TeamMember>(`/prestations/${prestationId}/team`, payload),
  removeTeamMember: (memberId: string) => del(`/prestation-team-members/${memberId}`),
  teamOverview: (params: Params) => get<{ data: TeamOverviewRow[] }>('/client-team', params).then((r) => r.data),

  // Notes (lecture seule staff, D5)
  reviews: (prestationId: string) => get<{ data: Review[]; summary: RatingSummary }>(`/prestations/${prestationId}/reviews`),
  reviewsSummary: (params: Params) => get<RatingSummary>('/prestations/reviews/summary', params),

  // Rapports, notifications, réglages
  report: (params: { department_id?: string; agency_id?: string; from?: string; to?: string }) => get<AgencyReport>('/reports/agency', params),
  notifications: (params?: { unread?: boolean }) =>
    get<LaravelPage<AgencyNotification> & { unread_count: number }>('/agency-notifications', params),
  markNotificationRead: (id: string) => post(`/agency-notifications/${id}/read`),
  markAllNotificationsRead: () => post('/agency-notifications/read-all'),
  settings: (departmentId: string) =>
    get<{ renew_alert_days: number[]; default_renew_alert_days: number[] }>(`/departments/${departmentId}/agency-settings`),
  updateSettings: (departmentId: string, renew_alert_days: number[]) =>
    put<{ renew_alert_days: number[] }>(`/departments/${departmentId}/agency-settings`, { renew_alert_days }),
};
