import { client } from './client';
import type { Module, ModulePayload, ReorderPayload } from '@/types/module';

export const modulesApi = {
  async list(formationId: string): Promise<Module[]> {
    const { data } = await client.get<Module[]>('/modules', {
      params: { formation_id: formationId },
    });
    return data;
  },

  async create(payload: ModulePayload): Promise<Module> {
    const { data } = await client.post<Module>('/modules', payload);
    return data;
  },

  async update(id: string, payload: Partial<ModulePayload>): Promise<Module> {
    const { data } = await client.put<Module>(`/modules/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/modules/${id}`);
  },

  async reorder(order: ReorderPayload): Promise<Module[]> {
    const { data } = await client.post<Module[]>('/modules/reorder', order);
    return data;
  },
};
