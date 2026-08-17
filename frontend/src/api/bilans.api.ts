import { client } from './client';
import type { DailyBilan, BilanParams } from '@/types/bilan';

export const bilansApi = {
  async daily(params: BilanParams = {}): Promise<DailyBilan> {
    const { data } = await client.get<DailyBilan>('/bilans', { params });
    return data;
  },
};
