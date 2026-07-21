"use client";

import { useEffect, useRef, useState } from "react";
import type { MdDialog } from "@material/web/dialog/dialog";
import { BLOCK_COLORS, DEFAULT_BLOCK_COLOR, type BlockInput } from "@/lib/blocks";
import type { BlockOccurrence } from "@/lib/recurrence";
import styles from "./event-dialog.module.css";

export type DialogState =
  | { mode: "create"; start: Date; end: Date }
  | { mode: "edit"; occurrence: BlockOccurrence };

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventDialog({
  state,
  readOnly,
  pending,
  error,
  quick = false,
  onClose,
  onSave,
  onDelete,
}: {
  state: DialogState;
  readOnly: boolean;
  pending: boolean;
  error: string | null;
  // Skip open/close animations (used on mobile, where the dialog is a
  // near-fullscreen sheet and must close reliably).
  quick?: boolean;
  onClose: () => void;
  onSave: (input: BlockInput, blockId?: string) => void;
  onDelete: (blockId: string) => void;
}) {
  const dialogRef = useRef<MdDialog | null>(null);
  const block = state.mode === "edit" ? state.occurrence : null;
  const [color, setColor] = useState<string>(
    block?.color ?? DEFAULT_BLOCK_COLOR,
  );

  const start = state.mode === "edit" ? state.occurrence.start : state.start;
  const end = state.mode === "edit" ? state.occurrence.end : state.end;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.show();
    // The page behind the dialog must not scroll while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleClosed = () => onClose();
    dialog.addEventListener("closed", handleClosed);
    return () => {
      dialog.removeEventListener("closed", handleClosed);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;

    const data = new FormData(event.currentTarget);
    const date = String(data.get("date"));
    const startTime = String(data.get("startTime"));
    const endTime = String(data.get("endTime"));

    const input: BlockInput = {
      title: String(data.get("title") ?? ""),
      start: `${date}T${startTime}:00`,
      end: `${date}T${endTime}:00`,
      description: String(data.get("description") ?? "") || undefined,
      blockers: String(data.get("blockers") ?? "") || undefined,
      solutionSteps: String(data.get("solutionSteps") ?? "") || undefined,
      location:
        (String(data.get("location")) as "home" | "office") || undefined,
      color,
      recurrence:
        (String(data.get("recurrence")) as BlockInput["recurrence"]) || "none",
      goLink: String(data.get("goLink") ?? "") || undefined,
      critiqueLink: String(data.get("critiqueLink") ?? "") || undefined,
      buganizerLink: String(data.get("buganizerLink") ?? "") || undefined,
    };

    onSave(input, block?.id);
  }

  return (
    <md-dialog ref={dialogRef} quick={quick || undefined}>
      <div slot="headline">
        {readOnly
          ? "Journal entry"
          : block
            ? "Edit journal entry"
            : "New journal entry"}
      </div>
      <form
        id="event-form"
        slot="content"
        className={styles.form}
        onSubmit={handleSubmit}
      >
        <md-outlined-text-field
          label="Title"
          name="title"
          required
          disabled={readOnly}
          value={block?.title ?? ""}
        />

        <div className={styles.row}>
          <label className={`${styles.timeField} body-small`}>
            Date
            <input
              type="date"
              name="date"
              required
              disabled={readOnly}
              defaultValue={toDateInput(start)}
            />
          </label>
          <label className={`${styles.timeField} body-small`}>
            From
            <input
              type="time"
              name="startTime"
              required
              disabled={readOnly}
              defaultValue={toTimeInput(start)}
            />
          </label>
          <label className={`${styles.timeField} body-small`}>
            To
            <input
              type="time"
              name="endTime"
              required
              disabled={readOnly}
              defaultValue={toTimeInput(end)}
            />
          </label>
        </div>

        <md-outlined-text-field
          label="Description"
          name="description"
          type="textarea"
          rows={2}
          disabled={readOnly}
          value={block?.description ?? ""}
        />
        <md-outlined-text-field
          label="Blockers"
          name="blockers"
          type="textarea"
          rows={2}
          disabled={readOnly}
          supporting-text="What blocked you, and who did you ask for help?"
          value={block?.blockers ?? ""}
        />
        <md-outlined-text-field
          label="Solution steps"
          name="solutionSteps"
          type="textarea"
          rows={2}
          disabled={readOnly}
          supporting-text="Steps you took to solve the problem"
          value={block?.solutionSteps ?? ""}
        />

        <div className={styles.row}>
          <md-outlined-select
            label="Work location"
            name="location"
            disabled={readOnly}
            value={block?.location ?? ""}
          >
            <md-select-option value="" aria-label="No location" />
            <md-select-option value="office">
              <div slot="headline">Office</div>
            </md-select-option>
            <md-select-option value="home">
              <div slot="headline">Home</div>
            </md-select-option>
          </md-outlined-select>

          <md-outlined-select
            label="Repeats"
            name="recurrence"
            disabled={readOnly}
            value={block?.recurrence ?? "none"}
          >
            <md-select-option value="none">
              <div slot="headline">Does not repeat</div>
            </md-select-option>
            <md-select-option value="weekly">
              <div slot="headline">Weekly</div>
            </md-select-option>
            <md-select-option value="biweekly">
              <div slot="headline">Every 2 weeks</div>
            </md-select-option>
          </md-outlined-select>
        </div>

        <div>
          <p className={`${styles.groupLabel} body-small`}>Color</p>
          <div className={styles.colorGroup} role="radiogroup" aria-label="Color">
            {BLOCK_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.name}
                title={c.name}
                disabled={readOnly}
                className={
                  color === c.value ? styles.swatchSelected : styles.swatch
                }
                style={{ background: c.value }}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <md-outlined-text-field
            label="Go link"
            name="goLink"
            disabled={readOnly}
            value={block?.goLink ?? ""}
          />
          <md-outlined-text-field
            label="Critique"
            name="critiqueLink"
            disabled={readOnly}
            value={block?.critiqueLink ?? ""}
          />
          <md-outlined-text-field
            label="Buganizer"
            name="buganizerLink"
            disabled={readOnly}
            value={block?.buganizerLink ?? ""}
          />
        </div>

        {error && <p className={`${styles.error} body-medium`}>{error}</p>}
      </form>
      <div slot="actions" className={styles.actions}>
        {!readOnly && block && (
          <md-text-button
            type="button"
            disabled={pending}
            onClick={() => onDelete(block.id)}
          >
            Delete
          </md-text-button>
        )}
        <div className={styles.actionsSpacer} />
        <md-text-button type="button" onClick={() => dialogRef.current?.close()}>
          {readOnly ? "Close" : "Cancel"}
        </md-text-button>
        {!readOnly && (
          <md-filled-button
            type="button"
            disabled={pending}
            onClick={() =>
              (
                document.getElementById("event-form") as HTMLFormElement | null
              )?.requestSubmit()
            }
          >
            {pending ? "Saving..." : "Save"}
          </md-filled-button>
        )}
      </div>
    </md-dialog>
  );
}
