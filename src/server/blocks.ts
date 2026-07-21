"use server";

import { and, eq, lt, gt, or, ne } from "drizzle-orm";
import { db } from "@/db";
import { calendarBlock, hostAssignment } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { blockInputSchema, listRangeSchema } from "@/lib/blocks";
import { expandOccurrences, type BlockOccurrence } from "@/lib/recurrence";

type SessionData = Awaited<ReturnType<typeof requireSession>>;

// A user may read a calendar if it is their own, or if they are an accepted
// host of that apprentice. Checked on the server for every request.
async function assertCanViewCalendar(session: SessionData, ownerId: string) {
  if (session.user.id === ownerId) {
    return;
  }
  const assignment = await db.query.hostAssignment.findFirst({
    where: and(
      eq(hostAssignment.apprenticeId, ownerId),
      eq(hostAssignment.hostId, session.user.id),
      eq(hostAssignment.status, "accepted"),
    ),
  });
  if (!assignment) {
    throw new Error("Not authorized to view this calendar");
  }
}

export async function listBlocks(input: {
  start: string;
  end: string;
  apprenticeId?: string;
}): Promise<BlockOccurrence[]> {
  const session = await requireSession();
  const { start, end, apprenticeId } = listRangeSchema.parse(input);
  const ownerId = apprenticeId ?? session.user.id;
  await assertCanViewCalendar(session, ownerId);

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

export async function createBlock(input: unknown) {
  const session = await requireSession();
  const data = blockInputSchema.parse(input);

  const [created] = await db
    .insert(calendarBlock)
    .values({
      userId: session.user.id,
      title: data.title,
      start: new Date(data.start),
      end: new Date(data.end),
      description: data.description || null,
      blockers: data.blockers || null,
      solutionSteps: data.solutionSteps || null,
      location: data.location ?? null,
      color: data.color ?? null,
      recurrence: data.recurrence,
      goLink: data.goLink || null,
      critiqueLink: data.critiqueLink || null,
      buganizerLink: data.buganizerLink || null,
    })
    .returning();

  return created;
}

export async function updateBlock(id: string, input: unknown) {
  const session = await requireSession();
  const data = blockInputSchema.parse(input);

  const [updated] = await db
    .update(calendarBlock)
    .set({
      title: data.title,
      start: new Date(data.start),
      end: new Date(data.end),
      description: data.description || null,
      blockers: data.blockers || null,
      solutionSteps: data.solutionSteps || null,
      location: data.location ?? null,
      color: data.color ?? null,
      recurrence: data.recurrence,
      goLink: data.goLink || null,
      critiqueLink: data.critiqueLink || null,
      buganizerLink: data.buganizerLink || null,
      updatedAt: new Date(),
    })
    // The userId condition is the authorization: only the owner matches.
    .where(and(eq(calendarBlock.id, id), eq(calendarBlock.userId, session.user.id)))
    .returning();

  if (!updated) {
    throw new Error("Block not found or not yours");
  }
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
