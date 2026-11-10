import { client } from './client';
import type { SecurityCenter } from '@/types/security';

export const securityApi = {
  async center(): Promise<SecurityCenter> {
    const { data } = await client.get<SecurityCenter>('/security/center');
    return data;
  },
};
