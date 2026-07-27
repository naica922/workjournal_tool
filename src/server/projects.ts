"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarBlock, project } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { assertCanViewCalendar } from "@/lib/access";
import { BLOCK_COLORS } from "@/lib/blocks";
import {
  buildProjectOverview,
  type ProjectOverview,
} from "@/lib/project-stats";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  color: z.enum(BLOCK_COLORS.map((c) => c.value) as [string, ...string[]]),
  icon: z.string().trim().max(8).optional(),
});

export async function listProjects(apprenticeId?: string) {
  const session = await requireSession();
  const ownerId = apprenticeId ?? session.user.id;
  await assertCanViewCalendar(session.user.id, ownerId);

  return db.query.project.findMany({
    where: eq(project.userId, ownerId),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  });
}

export async function createProject(input: unknown) {
  const session = await requireSession();
  const data = projectSchema.parse(input);

  const [created] = await db
    .insert(project)
    .values({
      userId: session.user.id,
      name: data.name,
      color: data.color,
      icon: data.icon || null,
    })
    .returning();
  return created;
}

export async function deleteProject(id: string) {
  const session = await requireSession();
  // Blocks keep existing; their project_id becomes null via the FK.
  const [deleted] = await db
    .delete(project)
    .where(and(eq(project.id, id), eq(project.userId, session.user.id)))
    .returning({ id: project.id });
  if (!deleted) {
    throw new Error("Project not found");
  }
  return deleted;
}

// Hours, events, blockers and links per project - for the apprentice
// themselves and for hosts with an accepted assignment.
export async function projectOverview(
  apprenticeId?: string,
): Promise<ProjectOverview[]> {
  const session = await requireSession();
  const ownerId = apprenticeId ?? session.user.id;
  await assertCanViewCalendar(session.user.id, ownerId);

  const [projects, blocks] = await Promise.all([
    db.query.project.findMany({
      where: eq(project.userId, ownerId),
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    }),
    db.query.calendarBlock.findMany({
      where: eq(calendarBlock.userId, ownerId),
    }),
  ]);

  return buildProjectOverview(projects, blocks);
}
