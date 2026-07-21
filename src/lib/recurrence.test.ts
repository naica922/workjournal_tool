import { describe, expect, it } from "vitest";
import type { CalendarBlock } from "@/db/schema";
import { expandOccurrences } from "./recurrence";

function makeBlock(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: "block-1",
    userId: "user-1",
    title: "Focus time",
    start: new Date("2026-07-20T09:00:00Z"),
    end: new Date("2026-07-20T10:00:00Z"),
    description: null,
    blockers: null,
    solutionSteps: null,
    location: null,
    color: null,
    recurrence: "none",
    goLink: null,
    critiqueLink: null,
    buganizerLink: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const weekStart = new Date("2026-07-20T00:00:00Z"); // Monday
const weekEnd = new Date("2026-07-25T00:00:00Z");

describe("expandOccurrences", () => {
  it("returns a non-recurring block inside the range once", () => {
    const result = expandOccurrences([makeBlock()], weekStart, weekEnd);
    expect(result).toHaveLength(1);
    expect(result[0].occurrenceId).toBe("block-1");
  });

  it("omits a non-recurring block outside the range", () => {
    const result = expandOccurrences(
      [makeBlock()],
      new Date("2026-07-27T00:00:00Z"),
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(result).toHaveLength(0);
  });

  it("repeats a weekly block in later weeks at the same time", () => {
    const laterWeekStart = new Date("2026-08-03T00:00:00Z");
    const laterWeekEnd = new Date("2026-08-08T00:00:00Z");
    const result = expandOccurrences(
      [makeBlock({ recurrence: "weekly" })],
      laterWeekStart,
      laterWeekEnd,
    );
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe("2026-08-03T09:00:00.000Z");
    expect(result[0].end.toISOString()).toBe("2026-08-03T10:00:00.000Z");
  });

  it("does not repeat a weekly block before its own start", () => {
    const earlierWeekStart = new Date("2026-07-13T00:00:00Z");
    const earlierWeekEnd = new Date("2026-07-18T00:00:00Z");
    const result = expandOccurrences(
      [makeBlock({ recurrence: "weekly" })],
      earlierWeekStart,
      earlierWeekEnd,
    );
    expect(result).toHaveLength(0);
  });

  it("repeats a biweekly block only every second week", () => {
    const block = makeBlock({ recurrence: "biweekly" });

    const nextWeek = expandOccurrences(
      [block],
      new Date("2026-07-27T00:00:00Z"),
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(nextWeek).toHaveLength(0);

    const weekAfter = expandOccurrences(
      [block],
      new Date("2026-08-03T00:00:00Z"),
      new Date("2026-08-08T00:00:00Z"),
    );
    expect(weekAfter).toHaveLength(1);
    expect(weekAfter[0].start.toISOString()).toBe("2026-08-03T09:00:00.000Z");
  });

  it("gives every occurrence of a series a distinct occurrence id", () => {
    const result = expandOccurrences(
      [makeBlock({ recurrence: "weekly" })],
      weekStart,
      new Date("2026-08-08T00:00:00Z"),
    );
    expect(result).toHaveLength(3);
    const ids = new Set(result.map((r) => r.occurrenceId));
    expect(ids.size).toBe(3);
  });

  it("sorts occurrences of multiple blocks chronologically", () => {
    const result = expandOccurrences(
      [
        makeBlock({
          id: "b2",
          start: new Date("2026-07-21T13:00:00Z"),
          end: new Date("2026-07-21T14:00:00Z"),
        }),
        makeBlock(),
      ],
      weekStart,
      weekEnd,
    );
    expect(result.map((r) => r.id)).toEqual(["block-1", "b2"]);
  });
});
