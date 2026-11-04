import { client } from './client';
import type { CountryStat } from '@/types/stats';

interface PaginatedResponse<T> {
  data: T[];
  links: { first: string; last: string; prev: string | null; next: string | null };
  meta: { current_page: number; from: number; last_page: number; per_page: number; to: number; total: number };
}

export interface CountryInvoiceSettings {
  company_name?: string | null;
  header_lines?: string | null;
  footer_lines?: string | null;
  stamp_url?: string | null;
  payment_accounts?: { label: string; details: string; holder?: string | null }[];
}

export interface CountryPayload {
  name: string;
  code: string;
  iso_code?: string;
  phone_code?: string;
  currency_code: string;
  exchange_rate?: number;
  invoice_settings?: CountryInvoiceSettings | null;
  is_active?: boolean;
}

export const countriesApi = {
  async list(params: { sort_by?: string; sort_order?: string; per_page?: number; search?: string } = {}, opts: { silentForbidden?: boolean } = {}): Promise<PaginatedResponse<CountryStat>> {
    const { data } = await client.get<PaginatedResponse<CountryStat>>('/countries', { params, silentForbidden: opts.silentForbidden });
    return data;
  },

  /**
   * Pays actifs du catalogue public (sans statistiques) : sélecteur de pays des
   * formulaires de déploiement pour les rôles sans accès aux fiches pays
   * (countries.consulter), ex. chef de département. Même forme que list().
   */
  async listActivePublic(): Promise<PaginatedResponse<CountryStat>> {
    const { data } = await client.get<Array<Pick<CountryStat, 'id' | 'name' | 'code' | 'currency_code' | 'iso_code' | 'phone_code' | 'agencies_count'>>>('/public/countries');
    const countries: CountryStat[] = data.map((c) => ({
      ...c,
      is_active: true,
      revenue: 0,
      outstanding: 0,
      invoices_count: 0,
    }));
    const n = countries.length;
    return {
      data: countries,
      links: { first: '', last: '', prev: null, next: null },
      meta: { current_page: 1, from: n ? 1 : 0, last_page: 1, per_page: n, to: n, total: n },
    };
  },

  async get(id: string): Promise<CountryStat> {
    const { data } = await client.get<CountryStat>(`/countries/${id}`);
    return data;
  },

  async create(payload: CountryPayload): Promise<CountryStat> {
    const { data } = await client.post<CountryStat>('/countries', payload);
    return data;
  },

  async update(id: string, payload: Partial<CountryPayload>): Promise<CountryStat> {
    const { data } = await client.put<CountryStat>(`/countries/${id}`, payload);
    return data;
  },
};
