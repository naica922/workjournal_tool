import type { BlockOccurrence } from "@/lib/recurrence";
import type { DayLocation } from "@/db/schema";
import { fridayCutoff, isLateEntry, weekMonday } from "@/lib/week";

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Day (YYYY-MM-DD) -> home/office, from the day-level location records.
export function dayLocationMap(
  locations: DayLocation[],
): Map<string, "home" | "office"> {
  const map = new Map<string, "home" | "office">();
  for (const l of locations) map.set(l.date, l.location as "home" | "office");
  return map;
}

// Weekly targets an apprentice is expected to meet.
export const WEEKLY_TARGET_HOURS = 40;

export type WeekStats = {
  entries: number;
  hours: number;
  officeHours: number;
  homeHours: number;
  late: number;
};

const HOUR_MS = 60 * 60 * 1000;

// Aggregates one week's log occurrences (all-day entries like OOO/school do
// not count as logged work hours).
export function weekStats(
  occurrences: BlockOccurrence[],
  monday: Date,
  dayLoc?: Map<string, "home" | "office">,
): WeekStats {
  const start = monday.getTime();
  const end = start + 7 * 24 * HOUR_MS;
  let entries = 0;
  let hours = 0;
  let officeHours = 0;
  let homeHours = 0;
  let late = 0;

  for (const occ of occurrences) {
    const t = occ.start.getTime();
    if (t < start || t >= end) continue;
    entries += 1;
    if (isLateEntry(occ.updatedAt, occ.start)) late += 1;
    if (occ.allDay) continue;
    const h = Math.max(0, (occ.end.getTime() - occ.start.getTime()) / HOUR_MS);
    hours += h;
    // Home/office is day-level; fall back to the old per-block value.
    const loc = dayLoc?.get(isoDay(occ.start)) ?? occ.location;
    if (loc === "home") homeHours += h;
    else if (loc === "office") officeHours += h;
  }
  return { entries, hours, officeHours, homeHours, late };
}

// Human-readable reasons an apprentice is below expectations for a sealed
// week (empty = on track). Only meaningful once the week's deadline passed.
export function expectationFlags(stats: WeekStats): string[] {
  const flags: string[] = [];
  if (stats.hours < WEEKLY_TARGET_HOURS) {
    flags.push(`Under ${WEEKLY_TARGET_HOURS} h (${stats.hours.toFixed(0)} h)`);
  }
  if (stats.late > 0) {
    flags.push(`${stats.late} late ${stats.late === 1 ? "entry" : "entries"}`);
  }
  return flags;
}

// The most recent week whose Friday 18:00 deadline has already passed.
export function lastCompletedMonday(now: Date): Date {
  const monday = weekMonday(now);
  if (fridayCutoff(monday).getTime() >= now.getTime()) {
    monday.setDate(monday.getDate() - 7);
  }
  return monday;
}
