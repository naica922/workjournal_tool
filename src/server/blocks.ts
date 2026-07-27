"use server";

import { and, eq, lt, gt, or, ne } from "drizzle-orm";
import { db } from "@/db";
import { calendarBlock, project } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { assertCanViewCalendar } from "@/lib/access";
import { blockInputSchema, listRangeSchema, type BlockInput } from "@/lib/blocks";
import { expandOccurrences, type BlockOccurrence } from "@/lib/recurrence";

export async function listBlocks(input: {
  start: string;
  end: string;
  apprenticeId?: string;
}): Promise<BlockOccurrence[]> {
  const session = await requireSession();
  const { start, end, apprenticeId } = listRangeSchema.parse(input);
  const ownerId = apprenticeId ?? session.user.id;
  await assertCanViewCalendar(session.user.id, ownerId);

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  const blocks = await db.query.calendarBlock.findMany({
    where: and(
      eq(calendarBlock.userId, ownerId),
      // Recurring blocks must be considered regardless of their start week.
      or(
        ne(calendarBlock.recurrence, "none"),
        and(lt(calendarBlock.start, rangeEnd), gt(calendarBlock.end, rangeStart)),
      ),
    ),
  });

  return expandOccurrences(blocks, rangeStart, rangeEnd);
}

// A block may only reference a project of the same user.
async function assertOwnProject(userId: string, projectId: string) {
  const owned = await db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.userId, userId)),
  });
  if (!owned) {
    throw new Error("Project not found");
  }
}

function blockValues(data: BlockInput) {
  const isCustom = data.recurrence === "custom";
  return {
    title: data.title,
    start: new Date(data.start),
    end: new Date(data.end),
    allDay: data.allDay,
    description: data.description || null,
    projectId: data.projectId ?? null,
    blockerEntries: data.blockerEntries.filter(
      (entry) => entry.blocker || entry.solutionSteps,
    ),
    location: data.location ?? null,
    color: data.color ?? null,
    recurrence: data.recurrence,
    recurrenceInterval: isCustom ? (data.recurrenceInterval ?? 1) : null,
    recurrenceUnit: isCustom ? (data.recurrenceUnit ?? "day") : null,
    goLink: data.goLink || null,
    critiqueLink: data.critiqueLink || null,
    buganizerLink: data.buganizerLink || null,
  };
}

export async function createBlock(input: unknown) {
  const session = await requireSession();
  const data = blockInputSchema.parse(input);
  if (data.projectId) {
    await assertOwnProject(session.user.id, data.projectId);
  }

  const [created] = await db
    .insert(calendarBlock)
    .values({ userId: session.user.id, ...blockValues(data) })
    .returning();

  return created;
}

export async function updateBlock(id: string, input: unknown) {
  const session = await requireSession();
  const data = blockInputSchema.parse(input);
  if (data.projectId) {
    await assertOwnProject(session.user.id, data.projectId);
  }

  const [updated] = await db
    .update(calendarBlock)
    .set({ ...blockValues(data), updatedAt: new Date() })
    // The userId condition is the authorization: only the owner matches.
    .where(and(eq(calendarBlock.id, id), eq(calendarBlock.userId, session.user.id)))
    .returning();

  if (!updated) {
    throw new Error("Block not found or not yours");
  }
  return updated;
}

// Drag-and-drop reschedule / resize: shift the block's start and end by the
// given deltas (in ms). For recurring blocks this moves the whole series.
export async function rescheduleBlock(
  id: string,
  startDeltaMs: number,
  endDeltaMs: number,
) {
  const session = await requireSession();

  const block = await db.query.calendarBlock.findFirst({
    where: and(
      eq(calendarBlock.id, id),
      eq(calendarBlock.userId, session.user.id),
    ),
  });
  if (!block) {
    throw new Error("Block not found or not yours");
  }

  const newStart = new Date(new Date(block.start).getTime() + startDeltaMs);
  const newEnd = new Date(new Date(block.end).getTime() + endDeltaMs);
  if (newEnd <= newStart) {
    throw new Error("End time must be after the start time");
  }

  const [updated] = await db
    .update(calendarBlock)
    .set({ start: newStart, end: newEnd, updatedAt: new Date() })
    .where(and(eq(calendarBlock.id, id), eq(calendarBlock.userId, session.user.id)))
    .returning({ id: calendarBlock.id });

  return updated;
}

export async function deleteBlock(id: string) {
  const session = await requireSession();

  const [deleted] = await db
    .delete(calendarBlock)
    .where(and(eq(calendarBlock.id, id), eq(calendarBlock.userId, session.user.id)))
    .returning({ id: calendarBlock.id });

  if (!deleted) {
    throw new Error("Block not found or not yours");
  }
  return deleted;
}
