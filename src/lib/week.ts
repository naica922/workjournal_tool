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

// 18:00 on the day of `date` — the daily seal deadline used when a host
// requires daily submission.
export function dailyCutoff(date: Date): Date {
  const day = new Date(date);
  day.setHours(SEAL_HOUR, 0, 0, 0);
  return day;
}

// An entry is late if it was created/changed after its seal deadline. That
// deadline is its day's 18:00 when daily submission is required, otherwise its
// week's Friday 18:00.
export function isLateEntry(
  updatedAt: Date | string,
  occurrenceStart: Date,
  daily = false,
): boolean {
  const updated =
    updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const cutoff = daily
    ? dailyCutoff(occurrenceStart)
    : fridayCutoff(occurrenceStart);
  return updated.getTime() > cutoff.getTime();
}

// The next daily seal deadline from `now`: today 18:00 if that is still
// ahead and today is a workday, otherwise 18:00 on the next workday
// (weekends roll to Monday).
export function nextDailyDeadline(now: Date): Date {
  const candidate = dailyCutoff(now);
  const isWorkday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
  if (isWorkday(now) && candidate.getTime() > now.getTime()) {
    return candidate;
  }
  do {
    candidate.setDate(candidate.getDate() + 1);
  } while (!isWorkday(candidate));
  return candidate;
}

// ISO week number (weeks start Monday; week 1 holds the first Thursday).
export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

// A stable key for grouping occurrences by week (the Monday's date).
export function weekKey(date: Date): string {
  const monday = weekMonday(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}
