export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

export interface Country {
  id: string;
  name: string;
  code?: string;
  iso_code?: string;
  phone_code?: string;
  currency_code?: string;
  is_active?: boolean;
  agencies_count?: number;
}

export interface Agency {
  id: string;
  name: string;
  code?: string;
  country_id?: string;
  city: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  payment_methods_count?: number;
  country?: { id?: string; name?: string } | string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  effective_price: number | string;
  agency_id?: string | null;
  category_id?: string | null;
  cover_image: string | null;
  presentation_video?: string | null;
  is_seminar?: boolean;
  is_public: boolean;
  slug: string;
  agency?: Agency;
  category?: Category | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  brand?: string | null;
  selling_price: number | string;
  price_with_tax?: number | string;
  tax_rate?: number | string;
  agency_id?: string | null;
  category_id?: string | null;
  cover_image: string | null;
  is_public?: boolean;
  slug: string;
  agency?: Agency;
  category?: Category | null;
}

export interface AgencyPaymentMethod {
  id: string;
  agency_id?: string;
  provider: string;
  phone_number: string | null;
  account_holder?: string | null;
  instructions?: string | null;
  is_active?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: { name: string } | null;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface Order {
  id: string;
  number: string;
  client_id: string;
  commercial_id: string | null;
  agency_id: string | null;
  channel: string;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  lines?: OrderLine[];
  invoice?: Invoice;
  agency?: {
    id: string;
    name: string;
    city: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
}

export interface OrderLine {
  id: string;
  service_id: string | null;
  product_id: string | null;
  label: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  number: string;
  client_id: string;
  order_id: string | null;
  agency_id: string | null;
  status: string;
  validation_status: string;
  validated_by: string | null;
  validated_at: string | null;
  rejection_reason: string | null;
  source: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  created_at: string;
}

export interface FormationEnrollment {
  id: string;
  learner_user_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  course?: {
    id: string;
    name: string;
    code?: string | null;
    mode?: string | null;
    description: string | null;
    duration_hours?: number | null;
    cover_image?: string | null;
    modules?: CourseModule[];
  };
}

export interface CourseModule {
  id: string;
  course_id?: string;
  name: string;
  order_index?: number;
  title?: string;
  description?: string | null;
  order?: number;
}

export interface ModulePresence {
  id: string;
  name: string;
  order_index?: number;
  presences: {
    present: number;
    absent: number;
    recorded: number;
  };
}

export interface LearnerCourse {
  id: string;
  enrolled_at: string;
  status: string;
  course: {
    id: string;
    name: string;
    code?: string | null;
    description: string | null;
    cover_image?: string | null;
    mode?: string | null;
  };
  invoice?: {
    id: string;
    number: string;
    validation_status: string;
    status: string;
    total_amount: number;
    amount_paid: number;
  } | null;
  modules: ModulePresence[];
}

export interface LearnerProfile {
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    client_number?: string | null;
    phone?: string | null;
  };
  courses: LearnerCourse[];
}

export interface Attendance {
  id: string;
  learner_user_id: string;
  training_session_id: string;
  course_module_id?: string | null;
  status: string;
  recorded_at?: string;
  date?: string;
  training_session?: {
    id: string;
    course_id: string;
    module_id?: string | null;
    start_at?: string | null;
    status?: string;
    course?: { id: string; name: string };
    module?: { id: string; name: string; order_index?: number };
  };
  course_module?: { id: string; name?: string; order_index?: number };
}

export interface LearnerObservation {
  id: string;
  learner_user_id: string;
  author_user_id: string | null;
  course_id?: string | null;
  course_module_id: string | null;
  session_id?: string | null;
  content: string;
  visible_to_client: boolean;
  created_at: string;
  author?: { id: string; first_name?: string; last_name?: string; name?: string };
  course_module?: { id: string; name?: string; order_index?: number };
  course?: { id: string; name?: string };
}

export interface LearnerProfile {
  id: string;
  user_id: string;
  total_observations: number;
  total_attendances: number;
  attendance_rate: number;
}

export interface PaymentProof {
  id: string;
  invoice_id: string;
  submitted_by: string | null;
  payment_method: string;
  phone_number_used: string | null;
  reference: string | null;
  file_path: string;
  status: string;
  notes: string | null;
  created_at: string;
}
