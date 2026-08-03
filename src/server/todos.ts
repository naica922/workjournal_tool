"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { project, todo, todoList } from "@/db/schema";
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

async function assertOwnList(userId: string, listId: string) {
  const owned = await db.query.todoList.findFirst({
    where: and(eq(todoList.id, listId), eq(todoList.userId, userId)),
  });
  if (!owned) {
    throw new Error("List not found");
  }
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function listTodoLists() {
  const session = await requireSession();
  return db.query.todoList.findMany({
    where: eq(todoList.userId, session.user.id),
    orderBy: (l, { asc }) => [asc(l.position), asc(l.createdAt)],
  });
}

export async function createTodoList(title: string) {
  const session = await requireSession();
  const clean = z.string().trim().min(1, "Title is required").max(200).parse(title);
  const existing = await db.query.todoList.findMany({
    where: eq(todoList.userId, session.user.id),
  });
  const [created] = await db
    .insert(todoList)
    .values({
      userId: session.user.id,
      title: clean,
      position: existing.length,
    })
    .returning();
  return created;
}

export async function renameTodoList(id: string, title: string) {
  const session = await requireSession();
  const clean = z.string().trim().min(1, "Title is required").max(200).parse(title);
  const [updated] = await db
    .update(todoList)
    .set({ title: clean, updatedAt: new Date() })
    .where(and(eq(todoList.id, id), eq(todoList.userId, session.user.id)))
    .returning({ id: todoList.id });
  if (!updated) throw new Error("List not found");
  return updated;
}

export async function deleteTodoList(id: string) {
  const session = await requireSession();
  // Tasks are removed with the list (ON DELETE cascade).
  await db
    .delete(todoList)
    .where(and(eq(todoList.id, id), eq(todoList.userId, session.user.id)));
  return { id };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTodos() {
  const session = await requireSession();
  return db.query.todo.findMany({
    where: eq(todo.userId, session.user.id),
    orderBy: (t, { asc }) => [asc(t.position), asc(t.createdAt)],
  });
}

// Open tasks of a project, for the Projects tab. Self only.
export async function listTodosForProject(projectId: string) {
  const session = await requireSession();
  return db.query.todo.findMany({
    where: and(
      eq(todo.userId, session.user.id),
      eq(todo.projectId, projectId),
    ),
    orderBy: (t, { asc }) => [asc(t.done), asc(t.position)],
  });
}

const createTodoSchema = todoInputSchema.extend({
  listId: z.uuid(),
});

export async function createTodo(input: unknown) {
  const session = await requireSession();
  const data = createTodoSchema.parse(input);
  await assertOwnList(session.user.id, data.listId);
  if (data.projectId) {
    await assertOwnProject(session.user.id, data.projectId);
  }

  // Append to the end of the list's open tasks.
  const openInList = await db.query.todo.findMany({
    where: and(
      eq(todo.userId, session.user.id),
      eq(todo.listId, data.listId),
      eq(todo.done, false),
    ),
  });

  const [created] = await db
    .insert(todo)
    .values({
      userId: session.user.id,
      listId: data.listId,
      title: data.title,
      description: data.description || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      projectId: data.projectId ?? null,
      position: openInList.length,
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
  const current = await db.query.todo.findFirst({
    where: and(eq(todo.id, id), eq(todo.userId, session.user.id)),
  });
  if (!current) throw new Error("To-do not found");

  // Put it at the end of the target group (done/open) in its list so the
  // ordering stays stable.
  let position = 0;
  if (current.listId) {
    const group = await db.query.todo.findMany({
      where: and(
        eq(todo.userId, session.user.id),
        eq(todo.listId, current.listId),
        eq(todo.done, done),
        ne(todo.id, id),
      ),
    });
    position = group.length;
  }

  await db
    .update(todo)
    .set({ done, status: done ? "done" : "open", position })
    .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)));
  return { id, done };
}

// The Kanban status label on open tasks (done is driven by the checkbox).
export async function setTodoStatus(
  id: string,
  status: "open" | "in_progress",
) {
  const session = await requireSession();
  const parsed = z.enum(["open", "in_progress"]).parse(status);
  await db
    .update(todo)
    .set({ status: parsed })
    .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)));
  return { id, status: parsed };
}

const moveSchema = z.object({
  id: z.uuid(),
  listId: z.uuid(),
  index: z.number().int().min(0),
});

// Drag-and-drop: move a task to a list at a given index among that list's
// open tasks, and renumber the affected lists so positions stay dense.
export async function moveTodo(input: unknown) {
  const session = await requireSession();
  const { id, listId, index } = moveSchema.parse(input);
  const userId = session.user.id;

  const moved = await db.query.todo.findFirst({
    where: and(eq(todo.id, id), eq(todo.userId, userId)),
  });
  if (!moved) throw new Error("To-do not found");
  await assertOwnList(userId, listId);

  const sourceListId = moved.listId;

  await db.transaction(async (tx) => {
    // Target list's open tasks without the moved one, in order.
    const targetOpen = (
      await tx.query.todo.findMany({
        where: and(
          eq(todo.userId, userId),
          eq(todo.listId, listId),
          eq(todo.done, false),
        ),
        orderBy: [asc(todo.position)],
      })
    ).filter((t) => t.id !== id);

    const clampedIndex = Math.min(Math.max(index, 0), targetOpen.length);
    const ordered = [
      ...targetOpen.slice(0, clampedIndex),
      moved,
      ...targetOpen.slice(clampedIndex),
    ];

    for (let i = 0; i < ordered.length; i++) {
      await tx
        .update(todo)
        .set(
          ordered[i].id === id
            ? { position: i, listId }
            : { position: i },
        )
        .where(eq(todo.id, ordered[i].id));
    }

    // If it came from another list, renumber that list's remaining open tasks.
    if (sourceListId && sourceListId !== listId) {
      const sourceOpen = await tx.query.todo.findMany({
        where: and(
          eq(todo.userId, userId),
          eq(todo.listId, sourceListId),
          eq(todo.done, false),
        ),
        orderBy: [asc(todo.position)],
      });
      for (let i = 0; i < sourceOpen.length; i++) {
        await tx
          .update(todo)
          .set({ position: i })
          .where(eq(todo.id, sourceOpen[i].id));
      }
    }
  });

  return { id, listId };
}

export async function deleteTodo(id: string) {
  const session = await requireSession();
  await db
    .delete(todo)
    .where(and(eq(todo.id, id), eq(todo.userId, session.user.id)));
  return { id };
}
