const RU_LOCALE: Intl.LocalesArgument = "ru-RU";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(RU_LOCALE, options).format(date);
}

export function formatTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(RU_LOCALE, options).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(RU_LOCALE, options).format(date);
}

export function calculateAge(birthDateString?: string | null): number | null {
  const birthDate = toDate(birthDateString || null);
  if (!birthDate) {
    return null;
  }
  const diff = Date.now() - birthDate.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return Number.isFinite(age) && age >= 0 ? age : null;
}

export function isPast(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  if (!date) {
    return false;
  }
  return date.getTime() < Date.now();
}

export function getWeekdayName(value: string | Date, capitalize = true): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  const name = new Intl.DateTimeFormat(RU_LOCALE, { weekday: "long" }).format(date);
  if (!capitalize) {
    return name;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}


