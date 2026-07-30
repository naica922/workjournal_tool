"use client";

import { useEffect, useRef } from "react";
import type { MdDialog } from "@material/web/dialog/dialog";
import type { Project, Todo } from "@/db/schema";
import styles from "./todos-view.module.css";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTodoDialog({
  todo,
  projects,
  pending,
  onClose,
  onSave,
}: {
  todo: Todo;
  projects: Project[];
  pending: boolean;
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
        className={styles.dialogForm}
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
            defaultValue={
              todo.deadline ? toLocalInput(new Date(todo.deadline)) : ""
            }
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
