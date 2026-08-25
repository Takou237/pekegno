import { client } from './client';

export interface ScopeDepartment {
  id: string;
  name: string;
  type: 'academy' | 'agency' | 'store' | 'studio';
}

export interface ScopeAgency {
  id: string;
  name: string;
  code: string;
  country_id: string;
  city_id: string | null;
  departments: ScopeDepartment[];
}

export interface ScopeCountry {
  id: string;
  name: string;
  code: string;
  currency_code: string;
  cities_count: number;
  agencies_count: number;
  agencies: ScopeAgency[];
}

export interface ScopeContextResponse {
  user: {
    is_global: boolean;
    assignments: {
      agency_id: string;
      department_id: string | null;
      is_primary: boolean;
    }[];
  };
  countries: ScopeCountry[];
}

export interface ContextSelection {
  countryId: string | null;
  agencyId: string | null;
  departmentId: string | null;
}

export const scopeApi = {
  async getContext(params?: { types?: string }): Promise<ScopeContextResponse> {
    const { data } = await client.get<ScopeContextResponse>('/scope/context', { params });
    return data;
  },
};
