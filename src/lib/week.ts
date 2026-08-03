// The work week runs Monday–Friday and is "sealed" every Friday at 18:00.
// Anything created or changed after that instant counts as a late entry for
// its week. All computations use local time (the app's users are in Zurich,
// so local == the intended Europe/Zurich wall clock).

const SEAL_HOUR = 18;

// Monday 00:00 of the week containing `date`.
export function weekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7; // getDay: 0=Sun..6=Sat
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

// Friday 18:00 of the week containing `date` — the weekly save/seal deadline.
export function fridayCutoff(date: Date): Date {
  const friday = weekMonday(date);
  friday.setDate(friday.getDate() + 4);
  friday.setHours(SEAL_HOUR, 0, 0, 0);
  return friday;
}

// An entry is late if it was created/changed after its week's seal deadline.
export function isLateEntry(updatedAt: Date | string, occurrenceStart: Date): boolean {
  const updated =
    updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  return updated.getTime() > fridayCutoff(occurrenceStart).getTime();
}

// A stable key for grouping occurrences by week (the Monday's date).
export function weekKey(date: Date): string {
  const monday = weekMonday(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}
