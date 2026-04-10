import type {
  ApiAthlete,
  ApiAttendance,
  ApiEntityType,
  ApiInjury,
  ApiNutritionPlan,
  ApiPaginatedResponse,
  ApiReport,
  ApiTokenResponse,
  ApiTrainingPlan,
  ApiUser,
  ApiUserFile,
  ApiWorkout,
} from "../types/api";
import type { WeatherInsights } from "../types/external";

const DEFAULT_BASE_URL = "http://localhost:8000";
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

type RequestOptions = RequestInit & { skipAuth?: boolean };

let authToken: string | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return normalizeApiErrorMessage(error.message, fallbackMessage);
  }

  return fallbackMessage;
}

function normalizeApiErrorMessage(message: string, fallbackMessage: string): string {
  const trimmed = message.trim();

  if (!trimmed) {
    return fallbackMessage;
  }

  const lowered = trimmed.toLowerCase();

  if (lowered.includes("invalid email or password")) {
    return "Неверный email или пароль. Проверьте данные и попробуйте ещё раз.";
  }

  if (lowered.includes("user already exists")) {
    return "Пользователь с таким email уже существует.";
  }

  if (lowered.includes("user is disabled")) {
    return "Этот аккаунт отключен. Обратитесь к администратору.";
  }

  if (lowered.includes("internal server error")) {
    return "На сервере произошла ошибка. Попробуйте ещё раз чуть позже.";
  }

  if (lowered.startsWith("request failed")) {
    return fallbackMessage;
  }

  return trimmed;
}

function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return extractApiErrorMessage(JSON.parse(trimmed)) ?? trimmed;
    } catch {
      return trimmed;
    }
  }

  if (typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (entry && typeof entry === "object" && "msg" in entry && typeof entry.msg === "string") {
            return entry.msg;
          }
          return null;
        })
        .filter(Boolean)
        .join(". ");
    }
    if ("message" in (payload as Record<string, unknown>) && typeof (payload as { message?: unknown }).message === "string") {
      return (payload as { message: string }).message;
    }
  }

  return null;
}

function buildQueryString(params?: QueryParams): string {
  if (!params) {
    return "";
  }

  const queryParts: string[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`);
      });
      return;
    }

    queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });

  return queryParts.length ? `?${queryParts.join("&")}` : "";
}

async function request<T>(path: string, params?: QueryParams, options?: RequestOptions): Promise<T> {
  const query = buildQueryString(params);
  const { skipAuth, headers: optionHeaders, ...restOptions } = options ?? {};
  const headers = new Headers(optionHeaders ?? {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!skipAuth && authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}${query}`, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const parsedMessage = extractApiErrorMessage(errorText);
    throw new Error(parsedMessage || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

type TrainingPlanPayload = {
  name: string;
  description?: string | null;
  weeks: number;
  plan_data?: string | null;
};

type WorkoutPayload = {
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
  training_plan_id?: number | null;
};

export const api = {
  login: (payload: { email: string; password: string }) =>
    request<ApiTokenResponse>("/auth/login", undefined, {
      method: "POST",
      skipAuth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  register: (payload: { email: string; password: string; full_name?: string }) =>
    request<ApiUser>("/auth/register", undefined, {
      method: "POST",
      skipAuth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getCurrentUser: () => request<ApiUser>("/auth/me"),

  getAthletes: (params?: QueryParams) => request<ApiAthlete[]>("/athletes/", params),
  getAthletesPaged: (params?: QueryParams) =>
    request<ApiPaginatedResponse<ApiAthlete>>("/athletes/paged", params),
  getAthlete: (id: number) => request<ApiAthlete>(`/athletes/${id}`),
  createAthlete: (payload: Partial<ApiAthlete> & { name: string }) =>
    request<ApiAthlete>("/athletes/", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateAthlete: (id: number, payload: Partial<ApiAthlete>) =>
    request<ApiAthlete>(`/athletes/${id}`, undefined, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  getTrainingPlans: (params?: QueryParams) => request<ApiTrainingPlan[]>("/training-plans/", params),
  createTrainingPlan: (payload: TrainingPlanPayload) =>
    request<ApiTrainingPlan>("/training-plans/", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateTrainingPlan: (id: number, payload: Partial<TrainingPlanPayload>) =>
    request<ApiTrainingPlan>(`/training-plans/${id}`, undefined, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteTrainingPlan: (id: number) =>
    request<void>(`/training-plans/${id}`, undefined, {
      method: "DELETE",
    }),

  getWorkouts: (params?: QueryParams) => request<ApiWorkout[]>("/workouts/", params),
  createWorkout: (payload: WorkoutPayload) =>
    request<ApiWorkout>("/workouts/", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateWorkout: (id: number, payload: Partial<WorkoutPayload>) =>
    request<ApiWorkout>(`/workouts/${id}`, undefined, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteWorkout: (id: number) =>
    request<void>(`/workouts/${id}`, undefined, {
      method: "DELETE",
    }),

  getAttendance: (params?: QueryParams) => request<ApiAttendance[]>("/attendance/", params),
  getInjuries: (params?: QueryParams) => request<ApiInjury[]>("/injuries/", params),
  getInjuriesPaged: (params?: QueryParams) =>
    request<ApiPaginatedResponse<ApiInjury>>("/injuries/paged", params),
  createInjury: (payload: {
    athlete_id: number;
    description: string;
    date: string;
    severity?: string;
    recovery_time?: number | null;
    medical_notes?: string | null;
    status?: string | null;
  }) =>
    request<ApiInjury>("/injuries/", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateInjury: (
    id: number,
    payload: Partial<{
      athlete_id: number;
      description: string;
      date: string;
      severity: string;
      recovery_time: number | null;
      medical_notes: string | null;
      status: string | null;
    }>
  ) =>
    request<ApiInjury>(`/injuries/${id}`, undefined, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteInjury: (id: number) =>
    request<void>(`/injuries/${id}`, undefined, {
      method: "DELETE",
    }),
  getNutritionPlans: (params?: QueryParams) => request<ApiNutritionPlan[]>("/nutrition-plans/", params),

  getReports: (params?: QueryParams) => request<ApiReport[]>("/reports/", params),
  generateReport: (type: string, params?: QueryParams) =>
    request<ApiReport>(`/reports/generate/${type}`, params),
  getWeatherInsights: (params?: QueryParams) =>
    request<WeatherInsights>("/external/weather", params),

  listFiles: (params: { entity_type: ApiEntityType; entity_id: number }) =>
    request<ApiUserFile[]>("/files", {
      entity_type: params.entity_type,
      entity_id: params.entity_id,
    }),
  uploadEntityFile: async (params: {
    file: File;
    entity_type: ApiEntityType;
    entity_id: number;
    set_as_photo?: boolean;
  }) => {
    const form = new FormData();
    form.append("file", params.file);
    form.append("entity_type", params.entity_type);
    form.append("entity_id", String(params.entity_id));
    if (params.set_as_photo != null) {
      form.append("set_as_photo", String(params.set_as_photo));
    }

    const headers = new Headers();
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const parsedMessage = extractApiErrorMessage(errorText);
      throw new Error(parsedMessage || `File upload failed (${response.status})`);
    }

    return (await response.json()) as ApiUserFile;
  },
  deleteFile: (fileId: number) =>
    request<void>(`/files/${fileId}`, undefined, {
      method: "DELETE",
    }),
};
