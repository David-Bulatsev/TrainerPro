export interface ApiAthlete {
  id: number;
  name: string;
  photo?: string | null;
  contact_info?: string | null;
  birth_date?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiTrainingPlan {
  id: number;
  name: string;
  description?: string | null;
  weeks: number;
  plan_data?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiWorkout {
  id: number;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
  training_plan_id?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiAttendance {
  id: number;
  athlete_id: number;
  workout_id: number;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiInjury {
  id: number;
  athlete_id: number;
  description: string;
  date: string;
  severity: string;
  recovery_time?: number | null;
  medical_notes?: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiNutritionPlan {
  id: number;
  athlete_id: number;
  plan_type?: string | null;
  meals?: string | null;
  restrictions?: string | null;
  calories?: number | null;
  macros?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiReport {
  id: number;
  type: string;
  title?: string | null;
  data: string;
  parameters?: string | null;
  generated_date: string;
  created_at: string;
}

export interface ApiUser {
  id: number;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  roles?: string[];
  permissions?: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiTokenResponse {
  access_token: string;
  token_type: string;
}

export type ApiEntityType = "athlete" | "injury";

export interface ApiUserFile {
  id: number;
  entity_type: ApiEntityType;
  entity_id: number;
  original_name: string;
  content_type?: string | null;
  size_bytes: number;
  created_at: string;
  download_url?: string | null;
}

export interface ApiPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}


