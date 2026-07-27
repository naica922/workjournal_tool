import { describe, expect, it } from "vitest";
import type { CalendarBlock, Project } from "@/db/schema";
import { buildProjectOverview, formatMinutes } from "./project-stats";

const projectA: Project = {
  id: "p-a",
  userId: "u1",
  name: "Coop event",
  color: "#039be5",
  icon: null,
  createdAt: new Date(),
};

function makeBlock(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: "b1",
    userId: "u1",
    projectId: "p-a",
    title: "Work",
    start: new Date("2026-07-06T09:00:00Z"),
    end: new Date("2026-07-06T10:30:00Z"),
    description: null,
    blockerEntries: [],
    location: null,
    color: null,
    allDay: false,
    recurrence: "none",
    recurrenceInterval: null,
    recurrenceUnit: null,
    goLink: null,
    critiqueLink: null,
    buganizerLink: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const until = new Date("2026-07-27T12:00:00Z");

describe("buildProjectOverview", () => {
  it("sums the duration of one-off events", () => {
    const [overview] = buildProjectOverview([projectA], [makeBlock()], until);
    expect(overview.totalMinutes).toBe(90);
    expect(overview.events[0].occurrences).toBe(1);
  });

  it("counts every past occurrence of a weekly event", () => {
    // Weekly since Jul 6: Jul 6, 13, 20, 27 within range = 4 occurrences.
    const [overview] = buildProjectOverview(
      [projectA],
      [makeBlock({ recurrence: "weekly" })],
      until,
    );
    expect(overview.events[0].occurrences).toBe(4);
    expect(overview.totalMinutes).toBe(4 * 90);
  });

  it("ignores blocks of other projects", () => {
    const [overview] = buildProjectOverview(
      [projectA],
      [makeBlock({ projectId: null })],
      until,
    );
    expect(overview.totalMinutes).toBe(0);
    expect(overview.events).toHaveLength(0);
  });

  it("collects blocker entries and links with their event titles", () => {
    const [overview] = buildProjectOverview(
      [projectA],
      [
        makeBlock({
          blockerEntries: [
            { blocker: "API down", solutionSteps: "Asked host" },
          ],
          goLink: "go/adcard",
        }),
      ],
      until,
    );
    expect(overview.blockerEntries).toEqual([
      { eventTitle: "Work", blocker: "API down", solutionSteps: "Asked host" },
    ]);
    expect(overview.links).toEqual([
      { eventTitle: "Work", label: "Go link", url: "go/adcard" },
    ]);
  });
});

describe("formatMinutes", () => {
  it("formats minutes, full hours and mixed durations", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(150)).toBe("2 h 30 min");
  });
});
