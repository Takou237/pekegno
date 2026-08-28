export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  services_count?: number;
}

export interface CategoryPayload {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface CourseCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  courses_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CourseCategoryPayload {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}
