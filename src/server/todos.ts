"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { project, todo } from "@/db/schema";
import { requireSession } from "@/lib/session";

const todoInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional(),
  // Datetime with offset from the client, or null.
  deadline: z.iso.datetime({ offset: true }).nullable().optional(),
  projectId: z.uuid().nullable().optional(),
});

async function assertOwnProject(userId: string, projectId: string) {
  const owned = await db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.userId, userId)),
  });
  if (!owned) {
    throw new Error("Project not found");
  }
}

export async function listTodos() {
  const session = await requireSession();
  return db.query.todo.findMany({
    where: eq(todo.userId, session.user.id),
    orderBy: (t, { asc }) => [asc(t.done), asc(t.deadline), asc(t.createdAt)],
  });
}

export async function createTodo(input: unknown) {
  const session = await requireSession();
  const data = todoInputSchema.parse(input);
  if (data.projectId) {
    await assertOwnProject(session.user.id, data.projectId);
  }

  const [created] = await db
    .insert(todo)
    .values({
      userId: session.user.id,
      title: data.title,
      description: data.description || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      projectId: data.projectId ?? null,
    })
    .returning();
  return created;
}

export async function updateTodo(id: string, input: unknown) {
  const session = await requireSession();
  const data = todoInputSchema.parse(input);
  if (data.projectId) {
    await assertOwnProject(session.user.id, data.projectId);
  }

  const [updated] = await db
    .update(todo)
    .set({
      title: data.title,
      description: data.description || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      projectId: data.projectId ?? null,
    })
    .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)))
    .returning({ id: todo.id });
  if (!updated) {
    throw new Error("To-do not found");
  }
  return updated;
}

export async function setTodoDone(id: string, done: boolean) {
  const session = await requireSession();
  await db
    .update(todo)
    .set({ done })
    .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)));
  return { id, done };
}

export async function deleteTodo(id: string) {
  const session = await requireSession();
  await db
    .delete(todo)
    .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)));
  return { id };
}
