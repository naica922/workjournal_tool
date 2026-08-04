import { describe, expect, it } from "vitest";
import {
  dailyCutoff,
  isLateEntry,
  nextDailyDeadline,
} from "./week";

describe("dailyCutoff", () => {
  it("is 18:00 on the entry's own day", () => {
    const cutoff = dailyCutoff(new Date("2026-08-05T09:30:00"));
    expect(cutoff.getHours()).toBe(18);
    expect(cutoff.getMinutes()).toBe(0);
    expect(cutoff.getDate()).toBe(5);
  });
});

describe("isLateEntry with daily submission", () => {
  const start = new Date("2026-08-05T09:00:00"); // Wednesday

  it("is on time when saved before the same day's 18:00", () => {
    expect(isLateEntry(new Date("2026-08-05T17:59:00"), start, true)).toBe(
      false,
    );
  });

  it("is late when saved after the same day's 18:00", () => {
    expect(isLateEntry(new Date("2026-08-05T18:30:00"), start, true)).toBe(
      true,
    );
  });

  it("is late the next morning, even though the week is not over", () => {
    expect(isLateEntry(new Date("2026-08-06T08:00:00"), start, true)).toBe(
      true,
    );
    // The same entry would NOT be late under the weekly rule yet.
    expect(isLateEntry(new Date("2026-08-06T08:00:00"), start, false)).toBe(
      false,
    );
  });
});

describe("nextDailyDeadline", () => {
  it("returns today 18:00 when the day is not over", () => {
    const next = nextDailyDeadline(new Date("2026-08-05T09:00:00")); // Wed
    expect(next.getDate()).toBe(5);
    expect(next.getHours()).toBe(18);
  });

  it("rolls to the next workday once 18:00 has passed", () => {
    const next = nextDailyDeadline(new Date("2026-08-05T19:00:00")); // Wed eve
    expect(next.getDate()).toBe(6); // Thursday
    expect(next.getHours()).toBe(18);
  });

  it("skips the weekend to Monday", () => {
    const next = nextDailyDeadline(new Date("2026-08-07T19:00:00")); // Fri eve
    expect(next.getDay()).toBe(1); // Monday
    expect(next.getDate()).toBe(10);
  });
});
