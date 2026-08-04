import type { Module } from '@/types/module';
import type { Service } from '@/types/service';

export interface Formation {
  id: string;
  type: 'presentiel' | 'distanciel';
  duration: string | null;
  conditions: string | null;
  deposit_amount: string | null;
  installments_count: number | null;
  online_payment: boolean;
  created_at: string;
  updated_at: string;
  service?: Service | null;
  modules?: Module[];
  modules_count?: number;
}

export interface FormationPayload {
  service_id?: string;
  type: 'presentiel' | 'distanciel';
  duration?: string | null;
  conditions?: string | null;
  deposit_amount?: string | number | null;
  installments_count?: number | null;
  online_payment?: boolean;
}
