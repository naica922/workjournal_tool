import { describe, expect, it } from "vitest";
import type { BlockOccurrence } from "@/lib/recurrence";
import {
  expectationFlags,
  lastCompletedMonday,
  weekStats,
  WEEKLY_TARGET_HOURS,
} from "@/lib/stats";

// Monday 2026-07-27 (local).
const monday = new Date(2026, 6, 27);

function occ(
  day: number,
  startHour: number,
  hours: number,
  extra: Partial<BlockOccurrence> = {},
): BlockOccurrence {
  const start = new Date(2026, 6, day, startHour);
  const end = new Date(2026, 6, day, startHour + hours);
  return {
    start,
    end,
    allDay: false,
    location: "office",
    updatedAt: start, // on time by default
    ...extra,
  } as BlockOccurrence;
}

describe("weekStats", () => {
  it("sums hours, splits by location, and counts entries", () => {
    const stats = weekStats(
      [
        occ(27, 9, 8), // Mon office 8h
        occ(28, 9, 8, { location: "home" }), // Tue home 8h
        occ(29, 9, 4), // Wed office 4h
      ],
      monday,
    );
    expect(stats.entries).toBe(3);
    expect(stats.hours).toBe(20);
    expect(stats.officeHours).toBe(12);
    expect(stats.homeHours).toBe(8);
    expect(stats.late).toBe(0);
  });

  it("ignores all-day entries in the hour total and other weeks", () => {
    const stats = weekStats(
      [
        occ(29, 0, 24, { allDay: true }), // OOO/school, no hours
        occ(29, 9, 5),
        occ(20, 9, 8), // previous week — excluded
      ],
      monday,
    );
    expect(stats.entries).toBe(2); // both this-week occurrences count as entries
    expect(stats.hours).toBe(5);
  });

  it("counts entries changed after the Friday 18:00 deadline as late", () => {
    const late = occ(27, 9, 2, {
      updatedAt: new Date(2026, 7, 3), // edited the following Monday
    });
    const stats = weekStats([late], monday);
    expect(stats.late).toBe(1);
  });
});

describe("expectationFlags", () => {
  it("flags weeks under the target and with late entries", () => {
    const flags = expectationFlags({
      entries: 2,
      hours: 10,
      officeHours: 10,
      homeHours: 0,
      late: 1,
    });
    expect(flags).toHaveLength(2);
    expect(flags[0]).toContain(String(WEEKLY_TARGET_HOURS));
    expect(flags[1]).toContain("late");
  });

  it("is empty for a full, on-time week", () => {
    expect(
      expectationFlags({
        entries: 5,
        hours: 40,
        officeHours: 40,
        homeHours: 0,
        late: 0,
      }),
    ).toEqual([]);
  });
});

describe("lastCompletedMonday", () => {
  it("returns the previous week while the current one is not yet sealed", () => {
    // Monday 2026-08-03: this week seals Fri 2026-08-07 18:00 (future).
    const m = lastCompletedMonday(new Date(2026, 7, 3, 10));
    expect(m.getFullYear()).toBe(2026);
    expect(m.getMonth()).toBe(6); // July
    expect(m.getDate()).toBe(27); // Mon 2026-07-27
  });
});
