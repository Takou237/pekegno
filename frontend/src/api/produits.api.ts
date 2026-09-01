import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { Produit, ProduitListParams, ProduitPayload, ProduitSearchItem } from '@/types/produit';

export const produitsApi = {
  async list(params: ProduitListParams = {}): Promise<PaginatedResponse<Produit>> {
    const { data } = await client.get<PaginatedResponse<Produit>>('/services', { params });
    return data;
  },

  async get(id: string): Promise<Produit> {
    const { data } = await client.get<Produit>(`/services/${id}`);
    return data;
  },

  async create(payload: ProduitPayload): Promise<Produit> {
    const { data } = await client.post<Produit>('/services', payload);
    return data;
  },

  async update(id: string, payload: Partial<ProduitPayload>): Promise<Produit> {
    const { data } = await client.put<Produit>(`/services/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/services/${id}`);
  },

  async trash(params: ProduitListParams = {}): Promise<PaginatedResponse<Produit>> {
    const { data } = await client.get<PaginatedResponse<Produit>>('/services/trash', {
      params,
    });
    return data;
  },

  async restore(id: string): Promise<Produit> {
    const { data } = await client.post<Produit>(`/services/${id}/restore`);
    return data;
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/services/${id}/force-delete`);
  },

  async search(q: string): Promise<ProduitSearchItem[]> {
    const { data } = await client.get<ProduitSearchItem[]>('/services/search', { params: { q } });
    return data;
  },

  async synchronizeFormations(): Promise<{
    created: number;
    updated: number;
    total_formations: number;
  }> {
    const { data } = await client.post<{ created: number; updated: number; total_formations: number }>(
      '/services/synchronize-formations'
    );
    return data;
  },
};
