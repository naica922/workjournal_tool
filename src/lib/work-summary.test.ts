import { describe, expect, it } from "vitest";
import type { CalendarBlock, Project } from "@/db/schema";
import { buildWorkSummary } from "./work-summary";

const project: Project = {
  id: "p1",
  userId: "u1",
  name: "Coop event",
  color: "#039be5",
  icon: null,
  link: null,
  poc: null,
  completedAt: null,
  createdAt: new Date(),
};

function block(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: "b1",
    userId: "u1",
    projectId: "p1",
    title: "Coop planning",
    start: new Date("2026-07-10T09:00:00Z"),
    end: new Date("2026-07-10T11:00:00Z"),
    allDay: false,
    description: null,
    blockerEntries: [],
    location: "office",
    color: null,
    recurrence: "none",
    recurrenceInterval: null,
    recurrenceUnit: null,
    links: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const from = new Date("2026-06-01T00:00:00Z");
const to = new Date("2026-07-27T00:00:00Z");

describe("buildWorkSummary", () => {
  it("summarizes hours and projects into sentences", () => {
    const summary = buildWorkSummary("Naima", [project], [block()], from, to);
    expect(summary.totalMinutes).toBe(120);
    expect(summary.entryCount).toBe(1);
    expect(summary.projects[0].name).toBe("Coop event");
    expect(summary.sentences[0]).toContain("Naima logged 2 h");
    expect(summary.sentences.join(" ")).toContain("Coop event");
  });

  it("counts every occurrence of a recurring block in the period", () => {
    const summary = buildWorkSummary(
      "Naima",
      [project],
      [block({ recurrence: "weekly" })],
      from,
      to,
    );
    // Weekly from Jul 10 within Jun 1 - Jul 27: Jul 10, 17, 24 = 3.
    expect(summary.entryCount).toBe(3);
    expect(summary.totalMinutes).toBe(360);
  });

  it("includes blockers and completed status in the summary", () => {
    const summary = buildWorkSummary(
      "Naima",
      [{ ...project, completedAt: new Date() }],
      [
        block({
          blockerEntries: [{ blocker: "API down", solutionSteps: "asked" }],
        }),
      ],
      from,
      to,
    );
    const text = summary.sentences.join(" ");
    expect(text).toContain("API down");
    expect(text).toContain("marked completed");
  });

  it("reports an empty period cleanly", () => {
    const summary = buildWorkSummary("Naima", [project], [], from, to);
    expect(summary.entryCount).toBe(0);
    expect(summary.sentences[0]).toContain("no journal entries");
  });
});
