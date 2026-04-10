export const DEFAULT_SITE_NAME = "Trainer Pro";
export const DEFAULT_SITE_DESCRIPTION =
  "Trainer Pro helps coaches manage athletes, sessions, attendance, and medical notes in one workspace.";

function normalizeUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function getSiteUrl() {
  const envUrl = import.meta.env.VITE_SITE_URL as string | undefined;
  if (envUrl) {
    return normalizeUrl(envUrl);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return normalizeUrl(window.location.origin);
  }

  return "http://localhost:3000";
}

export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

