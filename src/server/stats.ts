"use server";

import { and, eq, gt, gte, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarBlock,
  dayLocation,
  hostAssignment,
  user,
  type CalendarBlock,
  type DayLocation,
} from "@/db/schema";
import { requireSession } from "@/lib/session";

export type ApprenticeSummary = {
  assignmentId: string;
  id: string;
  name: string;
  email: string;
  apprenticeshipStart: string | null;
  team: string | null;
  // Whether this host requires the apprentice to submit their journal daily.
  dailySubmission: boolean;
  // Recent log blocks (recurring, or ending within the last ~5 weeks) so the
  // client can compute last week's stats in local time.
  blocks: CalendarBlock[];
  dayLocations: DayLocation[];
};

// For the host landing: accepted apprentices plus their recent log blocks.
export async function listApprenticeSummaries(): Promise<ApprenticeSummary[]> {
  const session = await requireSession();

  const apprentices = await db
    .select({
      assignmentId: hostAssignment.id,
      id: user.id,
      name: user.name,
      email: user.email,
      apprenticeshipStart: user.apprenticeshipStart,
      team: user.team,
      dailySubmission: hostAssignment.dailySubmission,
    })
    .from(hostAssignment)
    .innerJoin(user, eq(user.id, hostAssignment.apprenticeId))
    .where(
      and(
        eq(hostAssignment.hostId, session.user.id),
        eq(hostAssignment.status, "accepted"),
      ),
    );

  const ids = apprentices.map((a) => a.id);
  if (ids.length === 0) return [];

  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const blocks = await db.query.calendarBlock.findMany({
    where: and(
      inArray(calendarBlock.userId, ids),
      eq(calendarBlock.kind, "log"),
      or(ne(calendarBlock.recurrence, "none"), gt(calendarBlock.end, since)),
    ),
  });

  const byUser = new Map<string, CalendarBlock[]>();
  for (const block of blocks) {
    const list = byUser.get(block.userId) ?? [];
    list.push(block);
    byUser.set(block.userId, list);
  }

  const sinceDay = new Date(since).toISOString().slice(0, 10);
  const locations = await db.query.dayLocation.findMany({
    where: and(
      inArray(dayLocation.userId, ids),
      gte(dayLocation.date, sinceDay),
    ),
  });
  const locByUser = new Map<string, DayLocation[]>();
  for (const loc of locations) {
    const list = locByUser.get(loc.userId) ?? [];
    list.push(loc);
    locByUser.set(loc.userId, list);
  }

  return apprentices.map((a) => ({
    ...a,
    blocks: byUser.get(a.id) ?? [],
    dayLocations: locByUser.get(a.id) ?? [],
  }));
}
