import { client } from './client';
import type { DailyBilan, BilanPeriod, BilanParams, BilanPeriodParams } from '@/types/bilan';

export const bilansApi = {
  async daily(params: BilanParams = {}): Promise<DailyBilan> {
    const { data } = await client.get<DailyBilan>('/bilans', { params });
    return data;
  },

  async period(params: BilanPeriodParams): Promise<BilanPeriod> {
    const { data } = await client.get<BilanPeriod>('/bilans/period', { params });
    return data;
  },
};
