import { client } from './client';
import type { Country, Agency, Service, Product, PublicCourse, AgencyPaymentMethod } from '@/types';

export const publicApi = {
  async getCountries(): Promise<Country[]> {
    const { data } = await client.get<Country[]>('/public/countries');
    return data;
  },

  async getAgencies(params?: { country_id?: string }): Promise<Agency[]> {
    const { data } = await client.get<Agency[]>('/public/agencies', { params });
    return data;
  },

  async getServices(params?: { country_id?: string; agency_id?: string; category_id?: string }): Promise<Service[]> {
    const { data } = await client.get<Service[]>('/public/services', { params });
    return data;
  },

  async getService(idOrSlug: string): Promise<Service> {
    const { data } = await client.get<Service>(`/public/services/${idOrSlug}`);
    return data;
  },

  async getProducts(params?: { country_id?: string; agency_id?: string; category_id?: string }): Promise<Product[]> {
    const { data } = await client.get<Product[]>('/public/products', { params });
    return data;
  },

  async getProduct(idOrSlug: string): Promise<Product> {
    const { data } = await client.get<Product>(`/public/products/${idOrSlug}`);
    return data;
  },

  async getCourses(params?: { country_id?: string; agency_id?: string; category_id?: string }): Promise<PublicCourse[]> {
    const { data } = await client.get<PublicCourse[]>('/public/courses', { params });
    return data;
  },

  async getCourse(idOrSlug: string): Promise<PublicCourse> {
    const { data } = await client.get<PublicCourse>(`/public/courses/${idOrSlug}`);
    return data;
  },

  async getAgencyPaymentMethods(agencyId: string): Promise<AgencyPaymentMethod[]> {
    const { data } = await client.get<AgencyPaymentMethod[]>(`/public/agencies/${agencyId}/payment-methods`);
    return data;
  },
};
