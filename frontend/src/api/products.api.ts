import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';

export interface ProductSearchItem {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  selling_price: number | string;
  price_with_tax?: number | string | null;
  category?: string | null;
  is_stock_managed?: boolean;
}

export interface ProductPayload {
  name: string;
  selling_price: number;
  sku?: string;
  category_id?: string | null;
  brand?: string | null;
  purchase_price?: number | null;
  tax_rate?: number | null;
  agency_id?: string | null;
  is_stock_managed?: boolean;
  is_active?: boolean;
}

export const productsApi = {
  async list(params: Record<string, unknown> = {}): Promise<PaginatedResponse<ProductSearchItem>> {
    const { data } = await client.get<PaginatedResponse<ProductSearchItem>>('/products', { params });
    return data;
  },

  async create(payload: ProductPayload): Promise<ProductSearchItem> {
    const { data } = await client.post<ProductSearchItem>('/products', payload);
    return data;
  },

  async search(q: string, agencyId?: string): Promise<ProductSearchItem[]> {
    const { data } = await client.get<ProductSearchItem[]>('/products/search', {
      params: { q, agency_id: agencyId || undefined },
    });
    return data;
  },
};
