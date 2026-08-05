import { client } from './client';
import type { Setting, SettingsPayload } from '@/types/settings';

export const settingsApi = {
  async list(): Promise<Setting[]> {
    const { data } = await client.get<Setting[]>('/settings');
    return data;
  },

  async update(payload: SettingsPayload): Promise<Setting[]> {
    const { data } = await client.put<Setting[]>('/settings', payload);
    return data;
  },
};
