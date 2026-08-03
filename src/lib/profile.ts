// A birth date must be a real calendar date in the past (not the future,
// which the sign-up form previously accepted) and not absurdly old.
export function isValidBirthday(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliest = new Date("1900-01-01T00:00:00");
  return date < today && date >= earliest;
}

export const BIRTHDAY_ERROR =
  "Please enter a valid birth date in the past.";

// Today as YYYY-MM-DD, for a date input's max attribute.
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
