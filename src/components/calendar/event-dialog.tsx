"use client";

import { useEffect, useRef, useState } from "react";
import type { MdDialog } from "@material/web/dialog/dialog";
import {
  BLOCK_COLORS,
  BUGANIZER_PREFIX,
  CRITIQUE_PREFIX,
  DEFAULT_BLOCK_COLOR,
  type BlockInput,
} from "@/lib/blocks";
import type { BlockerEntry, Project } from "@/db/schema";
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

function stripBarePrefix(value: string, prefix: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === prefix ? undefined : trimmed;
}

// Collapsible section like "Blockers & solutions" or "Links & more".
function Expandable({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.expandable}>
      <button
        type="button"
        className={styles.expandableToggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <md-icon>{open ? "expand_less" : "expand_more"}</md-icon>
        <span className="body-medium">{label}</span>
        {!!badge && <span className={styles.expandableBadge}>{badge}</span>}
      </button>
      {open && <div className={styles.expandableContent}>{children}</div>}
    </div>
  );
}

export function EventDialog({
  state,
  readOnly,
  pending,
  error,
  quick = false,
  projects = [],
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
  projects?: Project[];
  onClose: () => void;
  onSave: (input: BlockInput, blockId?: string) => void;
  onDelete: (blockId: string) => void;
}) {
  const dialogRef = useRef<MdDialog | null>(null);
  const block = state.mode === "edit" ? state.occurrence : null;
  const [color, setColor] = useState<string>(
    block?.color ?? DEFAULT_BLOCK_COLOR,
  );
  const [blockerEntries, setBlockerEntries] = useState<BlockerEntry[]>(
    block?.blockerEntries?.length ? block.blockerEntries : [],
  );
  const [allDay, setAllDay] = useState<boolean>(block?.allDay ?? false);
  const [recurrence, setRecurrence] = useState<BlockInput["recurrence"]>(
    block?.recurrence ?? "none",
  );

  const start = state.mode === "edit" ? state.occurrence.start : state.start;
  const end = state.mode === "edit" ? state.occurrence.end : state.end;
  const linkCount = [
    block?.goLink,
    block?.critiqueLink,
    block?.buganizerLink,
  ].filter(Boolean).length;

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

  function updateEntry(
    index: number,
    field: keyof BlockerEntry,
    value: string,
  ) {
    setBlockerEntries((entries) =>
      entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;

    const data = new FormData(event.currentTarget);
    const date = String(data.get("date"));
    const endDate = String(data.get("endDate") || date);

    // All-day events span whole calendar days; timed events use the entered
    // start/end times. Times are interpreted in the browser's timezone and
    // sent as absolute timestamps (the server may run in UTC).
    let startIso: string;
    let endIso: string;
    if (allDay) {
      startIso = new Date(`${date}T00:00:00`).toISOString();
      const endExclusive = new Date(`${endDate}T00:00:00`);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endIso = endExclusive.toISOString();
    } else {
      const startTime = String(data.get("startTime"));
      const endTime = String(data.get("endTime"));
      startIso = new Date(`${date}T${startTime}:00`).toISOString();
      endIso = new Date(`${date}T${endTime}:00`).toISOString();
    }

    const input: BlockInput = {
      title: String(data.get("title") ?? ""),
      start: startIso,
      end: endIso,
      allDay,
      description: String(data.get("description") ?? "") || undefined,
      projectId: String(data.get("projectId") ?? "") || null,
      blockerEntries: blockerEntries.filter(
        (entry) => entry.blocker.trim() || entry.solutionSteps.trim(),
      ),
      location:
        (String(data.get("location")) as "home" | "office") || undefined,
      color,
      recurrence,
      recurrenceInterval:
        recurrence === "custom"
          ? Number(data.get("recurrenceInterval") || 1)
          : null,
      recurrenceUnit:
        recurrence === "custom"
          ? (String(data.get("recurrenceUnit")) as "day" | "week")
          : null,
      goLink: String(data.get("goLink") ?? "") || undefined,
      // A field left at just its prefix counts as empty.
      critiqueLink: stripBarePrefix(
        String(data.get("critiqueLink") ?? ""),
        CRITIQUE_PREFIX,
      ),
      buganizerLink: stripBarePrefix(
        String(data.get("buganizerLink") ?? ""),
        BUGANIZER_PREFIX,
      ),
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

        <label className={styles.allDayToggle}>
          <md-checkbox
            checked={allDay}
            disabled={readOnly}
            onInput={(e: React.FormEvent) =>
              setAllDay((e.target as HTMLInputElement).checked)
            }
          />
          <span className="body-medium">
            All day (e.g. out of office, school)
          </span>
        </label>

        {allDay ? (
          <div className={styles.row} key="allday-fields">
            <label className={`${styles.timeField} body-small`}>
              From
              <input
                type="date"
                name="date"
                required
                disabled={readOnly}
                defaultValue={toDateInput(start)}
              />
            </label>
            <label className={`${styles.timeField} body-small`}>
              To
              <input
                type="date"
                name="endDate"
                required
                disabled={readOnly}
                defaultValue={toDateInput(end)}
              />
            </label>
          </div>
        ) : (
          <div className={styles.row} key="timed-fields">
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
                step={900}
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
                step={900}
                disabled={readOnly}
                defaultValue={toTimeInput(end)}
              />
            </label>
          </div>
        )}

        <md-outlined-text-field
          label="Description"
          name="description"
          type="textarea"
          rows={2}
          disabled={readOnly}
          value={block?.description ?? ""}
        />

        <div className={styles.row}>
          <md-outlined-select
            label="Project"
            name="projectId"
            disabled={readOnly}
            value={block?.projectId ?? ""}
          >
            <md-select-option value="">
              <div slot="headline">No project</div>
            </md-select-option>
            {projects.map((p) => (
              <md-select-option key={p.id} value={p.id}>
                <div slot="headline">{p.name}</div>
                {p.icon && (
                  <md-icon slot="start" style={{ color: p.color }}>
                    {p.icon}
                  </md-icon>
                )}
              </md-select-option>
            ))}
          </md-outlined-select>

          <md-outlined-select
            label="Work location"
            name="location"
            disabled={readOnly}
            value={block?.location ?? ""}
          >
            <md-select-option value="">
              <div slot="headline">Not specified</div>
            </md-select-option>
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
            value={recurrence}
            onInput={(e: React.FormEvent) =>
              setRecurrence(
                (e.target as HTMLSelectElement).value as
                  BlockInput["recurrence"],
              )
            }
          >
            <md-select-option value="none">
              <div slot="headline">Does not repeat</div>
            </md-select-option>
            <md-select-option value="daily">
              <div slot="headline">Daily</div>
            </md-select-option>
            <md-select-option value="weekly">
              <div slot="headline">Weekly</div>
            </md-select-option>
            <md-select-option value="biweekly">
              <div slot="headline">Every 2 weeks</div>
            </md-select-option>
            <md-select-option value="custom">
              <div slot="headline">Custom…</div>
            </md-select-option>
          </md-outlined-select>
        </div>

        {recurrence === "custom" && (
          <div className={styles.row}>
            <md-outlined-text-field
              label="Every"
              name="recurrenceInterval"
              type="number"
              min="1"
              max="52"
              disabled={readOnly}
              value={String(block?.recurrenceInterval ?? 1)}
            />
            <md-outlined-select
              label="Unit"
              name="recurrenceUnit"
              disabled={readOnly}
              value={block?.recurrenceUnit ?? "day"}
            >
              <md-select-option value="day">
                <div slot="headline">Days</div>
              </md-select-option>
              <md-select-option value="week">
                <div slot="headline">Weeks</div>
              </md-select-option>
            </md-outlined-select>
          </div>
        )}

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

        <Expandable label="Blockers & solutions" badge={blockerEntries.length}>
          {blockerEntries.map((entry, index) => (
            <div key={index} className={styles.blockerPair}>
              <div className={styles.blockerPairHeader}>
                <span className="body-small">Blocker {index + 1}</span>
                {!readOnly && (
                  <md-icon-button
                    type="button"
                    title={`Remove blocker ${index + 1}`}
                    onClick={() =>
                      setBlockerEntries((entries) =>
                        entries.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                )}
              </div>
              <md-outlined-text-field
                label="Blocker"
                data-testid={`blocker-${index}`}
                type="textarea"
                rows={2}
                disabled={readOnly}
                placeholder="What blocked you, and who did you ask for help?"
                value={entry.blocker}
                onInput={(e: React.FormEvent) =>
                  updateEntry(
                    index,
                    "blocker",
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
              <md-outlined-text-field
                label="Solution steps"
                data-testid={`solution-${index}`}
                type="textarea"
                rows={2}
                disabled={readOnly}
                placeholder="Steps you took to solve this blocker"
                value={entry.solutionSteps}
                onInput={(e: React.FormEvent) =>
                  updateEntry(
                    index,
                    "solutionSteps",
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
            </div>
          ))}
          {!readOnly && (
            <md-text-button
              type="button"
              onClick={() =>
                setBlockerEntries((entries) => [
                  ...entries,
                  { blocker: "", solutionSteps: "" },
                ])
              }
            >
              Add blocker
            </md-text-button>
          )}
          {readOnly && blockerEntries.length === 0 && (
            <p className={`${styles.groupLabel} body-small`}>No blockers.</p>
          )}
        </Expandable>

        <Expandable label="Links & more" badge={linkCount}>
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
            value={block?.critiqueLink ?? (readOnly ? "" : CRITIQUE_PREFIX)}
          />
          <md-outlined-text-field
            label="Buganizer"
            name="buganizerLink"
            disabled={readOnly}
            value={block?.buganizerLink ?? (readOnly ? "" : BUGANIZER_PREFIX)}
          />
        </Expandable>

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
