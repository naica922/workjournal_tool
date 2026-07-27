"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MdDialog } from "@material/web/dialog/dialog";
import {
  createTodo,
  deleteTodo,
  listTodos,
  setTodoDone,
  updateTodo,
} from "@/server/todos";
import { listProjects } from "@/server/projects";
import type { Project, Todo } from "@/db/schema";
import styles from "./todos-view.module.css";

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TodosView() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Todo | null>(null);

  const { data: todos } = useQuery({
    queryKey: ["todos"],
    queryFn: () => listTodos(),
  });
  const { data: projects } = useQuery({
    queryKey: ["projects", "me"],
    queryFn: () => listProjects(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["todos"] });

  const createMutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });
  const doneMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      setTodoDone(id, done),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTodo,
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      updateTodo(id, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const projectName = (id: string | null) =>
    id ? (projects?.find((p) => p.id === id)?.name ?? null) : null;

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const deadlineRaw = String(data.get("deadline") ?? "");
    createMutation.mutate({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? "") || undefined,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      projectId: String(data.get("projectId") ?? "") || null,
    });
    form.reset();
  }

  const open = (todos ?? []).filter((t) => !t.done);
  const done = (todos ?? []).filter((t) => t.done);

  function renderTodo(t: Todo) {
    const deadline = t.deadline ? new Date(t.deadline) : null;
    const overdue = deadline && !t.done && deadline.getTime() < Date.now();
    return (
      <li key={t.id} className={styles.item}>
        <md-checkbox
          checked={t.done}
          aria-label={t.done ? "Mark as not done" : "Mark as done"}
          onInput={(e: React.FormEvent) =>
            doneMutation.mutate({
              id: t.id,
              done: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <div className={styles.itemBody}>
          <p
            className={`${t.done ? styles.itemTitleDone : styles.itemTitle} body-medium`}
          >
            {t.title}
          </p>
          {t.description && (
            <p className={`${styles.empty} body-small`}>{t.description}</p>
          )}
          {(deadline || t.projectId) && (
            <p className={`${styles.itemMeta} body-small`}>
              {deadline && (
                <span className={overdue ? styles.deadlineOverdue : undefined}>
                  <md-icon
                    style={{
                      fontSize: "1rem",
                      width: "1rem",
                      height: "1rem",
                      verticalAlign: "middle",
                    }}
                  >
                    schedule
                  </md-icon>{" "}
                  {dateTimeFmt.format(deadline)}
                </span>
              )}
              {projectName(t.projectId) && (
                <span className={styles.projectTag}>
                  <md-icon
                    style={{ fontSize: "1rem", width: "1rem", height: "1rem" }}
                  >
                    folder
                  </md-icon>
                  {projectName(t.projectId)}
                </span>
              )}
            </p>
          )}
        </div>
        <md-icon-button
          type="button"
          aria-label="Edit to-do"
          onClick={() => {
            setError(null);
            setEditing(t);
          }}
        >
          <md-icon>edit</md-icon>
        </md-icon-button>
        <md-icon-button
          type="button"
          aria-label="Delete to-do"
          onClick={() => deleteMutation.mutate(t.id)}
        >
          <md-icon>delete</md-icon>
        </md-icon-button>
      </li>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={`${styles.heading} headline-small`}>To-dos</h1>

      <div className={styles.columns}>
        <div className={styles.left}>
          <section className={styles.card}>
            <h2 className={`${styles.cardTitle} title-medium`}>New to-do</h2>
            <form className={styles.form} onSubmit={handleCreate}>
          <md-outlined-text-field label="Title" name="title" required />
          <md-outlined-text-field
            label="Description"
            name="description"
            type="textarea"
            rows={2}
          />
          <div className={styles.row}>
            <label className={`${styles.dateField} body-small`}>
              Deadline (optional)
              <input type="datetime-local" name="deadline" />
            </label>
            <md-outlined-select label="Project (optional)" name="projectId">
              <md-select-option value="">
                <div slot="headline">No project</div>
              </md-select-option>
              {(projects ?? []).map((p) => (
                <md-select-option key={p.id} value={p.id}>
                  <div slot="headline">{p.name}</div>
                </md-select-option>
              ))}
            </md-outlined-select>
          </div>
            {error && <p className={`${styles.error} body-medium`}>{error}</p>}
            <div className={styles.actions}>
              <md-filled-tonal-button
                type="submit"
                disabled={createMutation.isPending}
              >
                Add to-do
              </md-filled-tonal-button>
            </div>
            </form>
          </section>
        </div>

        <div className={styles.right}>
          <section className={styles.card}>
            <h2 className={`${styles.cardTitle} title-medium`}>Open</h2>
            <ul className={styles.list}>
              {open.map(renderTodo)}
              {open.length === 0 && (
                <li className={`${styles.empty} body-medium`}>
                  Nothing to do. Add a to-do on the left.
                </li>
              )}
            </ul>
          </section>

          {done.length > 0 && (
            <section className={styles.card}>
              <h2 className={`${styles.cardTitle} title-medium`}>Done</h2>
              <ul className={styles.list}>{done.map(renderTodo)}</ul>
            </section>
          )}
        </div>
      </div>

      {editing && (
        <EditTodoDialog
          key={editing.id}
          todo={editing}
          projects={projects ?? []}
          pending={updateMutation.isPending}
          error={error}
          onClose={() => setEditing(null)}
          onSave={(input) => updateMutation.mutate({ id: editing.id, input })}
        />
      )}
    </div>
  );
}

function EditTodoDialog({
  todo,
  projects,
  pending,
  error,
  onClose,
  onSave,
}: {
  todo: Todo;
  projects: Project[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description?: string;
    deadline: string | null;
    projectId: string | null;
  }) => void;
}) {
  const dialogRef = useRef<MdDialog | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.show();
    const handleClosed = () => onClose();
    dialog.addEventListener("closed", handleClosed);
    return () => dialog.removeEventListener("closed", handleClosed);
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const deadlineRaw = String(data.get("deadline") ?? "");
    onSave({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? "") || undefined,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      projectId: String(data.get("projectId") ?? "") || null,
    });
  }

  return (
    <md-dialog ref={dialogRef}>
      <div slot="headline">Edit to-do</div>
      <form
        id="edit-todo-form"
        slot="content"
        className={styles.form}
        onSubmit={handleSubmit}
      >
        <md-outlined-text-field
          label="Title"
          name="title"
          required
          value={todo.title}
        />
        <md-outlined-text-field
          label="Description"
          name="description"
          type="textarea"
          rows={2}
          value={todo.description ?? ""}
        />
        <label className={`${styles.dateField} body-small`}>
          Deadline (optional)
          <input
            type="datetime-local"
            name="deadline"
            defaultValue={todo.deadline ? toLocalInput(new Date(todo.deadline)) : ""}
          />
        </label>
        <md-outlined-select
          label="Project (optional)"
          name="projectId"
          value={todo.projectId ?? ""}
        >
          <md-select-option value="">
            <div slot="headline">No project</div>
          </md-select-option>
          {projects.map((p) => (
            <md-select-option key={p.id} value={p.id}>
              <div slot="headline">{p.name}</div>
            </md-select-option>
          ))}
        </md-outlined-select>
        {error && <p className={`${styles.error} body-medium`}>{error}</p>}
      </form>
      <div slot="actions">
        <md-text-button type="button" onClick={() => dialogRef.current?.close()}>
          Cancel
        </md-text-button>
        <md-filled-button
          type="button"
          disabled={pending}
          onClick={() =>
            (
              document.getElementById("edit-todo-form") as HTMLFormElement | null
            )?.requestSubmit()
          }
        >
          {pending ? "Saving..." : "Save"}
        </md-filled-button>
      </div>
    </md-dialog>
  );
}
