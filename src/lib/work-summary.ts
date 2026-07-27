import type { CalendarBlock, Project } from "@/db/schema";
import { expandOccurrences } from "@/lib/recurrence";
import { formatMinutes } from "@/lib/project-stats";

export type WorkSummaryProject = {
  name: string;
  minutes: number;
  entryTitles: string[];
  blockers: string[];
  completed: boolean;
};

export type WorkSummary = {
  personName: string;
  from: Date;
  to: Date;
  totalMinutes: number;
  entryCount: number;
  projects: WorkSummaryProject[];
  unassignedMinutes: number;
  // Template-generated prose (swap for an AI call behind an env var later).
  sentences: string[];
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

// Builds a work summary for [from, to): recurring events are expanded so each
// occurrence in the period counts. The sentences are a deterministic template;
// with an Anthropic API key configured they could be generated with AI.
export function buildWorkSummary(
  personName: string,
  projects: Project[],
  blocks: CalendarBlock[],
  from: Date,
  to: Date,
): WorkSummary {
  const occurrences = expandOccurrences(blocks, from, to);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const byProject = new Map<
    string | null,
    { minutes: number; titles: Set<string>; blockers: string[] }
  >();

  let totalMinutes = 0;
  for (const occ of occurrences) {
    const minutes = Math.round(
      (occ.end.getTime() - occ.start.getTime()) / 60_000,
    );
    totalMinutes += minutes;
    const key = occ.projectId ?? null;
    const bucket = byProject.get(key) ?? {
      minutes: 0,
      titles: new Set<string>(),
      blockers: [],
    };
    bucket.minutes += minutes;
    bucket.titles.add(occ.title);
    for (const entry of occ.blockerEntries ?? []) {
      if (entry.blocker) bucket.blockers.push(entry.blocker);
    }
    byProject.set(key, bucket);
  }

  const projectSummaries: WorkSummaryProject[] = [];
  let unassignedMinutes = 0;
  for (const [key, bucket] of byProject) {
    if (key === null) {
      unassignedMinutes = bucket.minutes;
      continue;
    }
    const project = projectById.get(key);
    if (!project) continue;
    projectSummaries.push({
      name: project.name,
      minutes: bucket.minutes,
      entryTitles: [...bucket.titles],
      blockers: bucket.blockers,
      completed: !!project.completedAt,
    });
  }
  projectSummaries.sort((a, b) => b.minutes - a.minutes);

  const sentences: string[] = [];
  const period = `${dateFmt.format(from)} and ${dateFmt.format(to)}`;
  if (occurrences.length === 0) {
    sentences.push(
      `Between ${period}, no journal entries were recorded for ${personName}.`,
    );
  } else {
    const projectNames = projectSummaries.map((p) => p.name);
    const projectList =
      projectNames.length > 1
        ? `${projectNames.slice(0, -1).join(", ")} and ${projectNames.at(-1)}`
        : (projectNames[0] ?? "various tasks");
    sentences.push(
      `Between ${period}, ${personName} logged ${formatMinutes(totalMinutes)} of work across ${occurrences.length} journal ${occurrences.length === 1 ? "entry" : "entries"}.`,
    );
    if (projectSummaries.length > 0) {
      sentences.push(
        `The work was distributed over ${projectSummaries.length} ${projectSummaries.length === 1 ? "project" : "projects"}: ${projectList}.`,
      );
    }
    for (const project of projectSummaries) {
      const titles = project.entryTitles.slice(0, 5).join(", ");
      let sentence = `On "${project.name}", ${personName} spent ${formatMinutes(project.minutes)}`;
      sentence += titles ? `, working on ${titles}.` : ".";
      if (project.blockers.length > 0) {
        sentence += ` Blockers encountered included: ${project.blockers.slice(0, 3).join("; ")}.`;
      }
      if (project.completed) {
        sentence += " This project has since been marked completed.";
      }
      sentences.push(sentence);
    }
    if (unassignedMinutes > 0) {
      sentences.push(
        `A further ${formatMinutes(unassignedMinutes)} was spent on entries not assigned to a project.`,
      );
    }
  }

  return {
    personName,
    from,
    to,
    totalMinutes,
    entryCount: occurrences.length,
    projects: projectSummaries,
    unassignedMinutes,
    sentences,
  };
}
