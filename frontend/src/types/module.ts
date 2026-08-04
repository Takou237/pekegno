export type ModuleType = 'video' | 'pdf' | 'cours' | 'exercice' | 'quiz';

export interface ModuleTrainer {
  id: string;
  name: string | null;
}

export interface Module {
  id: string;
  formation_id: string;
  trainer_id: string | null;
  name: string;
  order: number;
  description: string | null;
  type: ModuleType;
  cover_image: string | null;
  video: string | null;
  pdf: string | null;
  trainer?: ModuleTrainer | null;
}

export interface ModulePayload {
  formation_id?: string;
  trainer_id?: string | null;
  name: string;
  order?: number;
  description?: string | null;
  type: ModuleType;
  cover_image?: string | null;
  video?: string | null;
  pdf?: string | null;
}

export interface ReorderPayload {
  order: string[];
}
