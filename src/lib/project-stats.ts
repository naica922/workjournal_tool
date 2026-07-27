import type { CalendarBlock, Project } from "@/db/schema";
import { expandOccurrences } from "@/lib/recurrence";

export type ProjectOverview = {
  project: Project;
  totalMinutes: number;
  events: {
    id: string;
    title: string;
    start: Date;
    minutes: number;
    occurrences: number;
    recurrence: CalendarBlock["recurrence"];
  }[];
  blockerEntries: { eventTitle: string; blocker: string; solutionSteps: string }[];
  links: { eventTitle: string; label: string; url: string }[];
};

// Time invested per project: every occurrence of a block that has already
// started counts (recurring blocks are expanded up to `until`).
export function buildProjectOverview(
  projects: Project[],
  blocks: CalendarBlock[],
  until: Date = new Date(),
): ProjectOverview[] {
  return projects.map((project) => {
    const projectBlocks = blocks.filter(
      (block) => block.projectId === project.id,
    );

    const events = projectBlocks.map((block) => {
      const durationMinutes = Math.round(
        (new Date(block.end).getTime() - new Date(block.start).getTime()) /
          60_000,
      );
      const occurrences = expandOccurrences(
        [block],
        new Date(0),
        until,
      ).length;
      return {
        id: block.id,
        title: block.title,
        start: new Date(block.start),
        minutes: durationMinutes * occurrences,
        occurrences,
        recurrence: block.recurrence,
      };
    });

    const blockerEntries = projectBlocks.flatMap((block) =>
      (block.blockerEntries ?? [])
        .filter((entry) => entry.blocker || entry.solutionSteps)
        .map((entry) => ({ eventTitle: block.title, ...entry })),
    );

    const links = projectBlocks.flatMap((block) =>
      (
        [
          ["Go link", block.goLink],
          ["Critique", block.critiqueLink],
          ["Buganizer", block.buganizerLink],
        ] as const
      )
        .filter(([, url]) => !!url)
        .map(([label, url]) => ({ eventTitle: block.title, label, url: url! })),
    );

    return {
      project,
      totalMinutes: events.reduce((sum, event) => sum + event.minutes, 0),
      events: events.sort((a, b) => b.start.getTime() - a.start.getTime()),
      blockerEntries,
      links,
    };
  });
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
