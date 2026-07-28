"use client";

import { useEffect, useRef, useState } from "react";
import type { MdDialog } from "@material/web/dialog/dialog";
import {
  BLOCK_COLORS,
  DEFAULT_BLOCK_COLOR,
  LINK_TYPES,
  type BlockInput,
} from "@/lib/blocks";
import type { BlockerEntry, EventLink, Project } from "@/db/schema";
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

// Times to pick from, in 15-minute steps, so the fields are not free text.
const TIME_OPTIONS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// Nearest option to a "HH:MM" value (snaps stored times onto the 15-min grid).
function snapTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const snapped = Math.round(m / 15) * 15;
  const hour = h + (snapped === 60 ? 1 : 0);
  const min = snapped === 60 ? 0 : snapped;
  return `${String(hour % 24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


// Collapsible card like "Blockers & solutions" or "Links & more"; open by
// default on desktop, collapsed on the mobile sheet to keep it short.
function Expandable({
  label,
  badge,
  defaultOpen = false,
  children,
}: {
  label: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
  const [links, setLinks] = useState<EventLink[]>(block?.links ?? []);
  const [localError, setLocalError] = useState<string | null>(null);

  const start = state.mode === "edit" ? state.occurrence.start : state.start;
  const end = state.mode === "edit" ? state.occurrence.end : state.end;

  const [date, setDate] = useState(toDateInput(start));
  const [endDate, setEndDate] = useState(toDateInput(end));
  const [startTime, setStartTime] = useState(snapTime(toTimeInput(start)));
  const [endTime, setEndTime] = useState(snapTime(toTimeInput(end)));

  // Switching an all-day event to a timed one: if the derived times collapse
  // to the same value (00:00-00:00), pick a sensible one-hour slot instead.
  function handleAllDayChange(checked: boolean) {
    setAllDay(checked);
    if (!checked && startTime === endTime) {
      const newStart = startTime === "00:00" ? "09:00" : startTime;
      setStartTime(newStart);
      setEndTime(addHour(newStart));
    }
  }

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

    // All-day events span whole calendar days; timed events use the picked
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
      if (endTime <= startTime) {
        setLocalError("The end time must be after the start time.");
        return;
      }
      startIso = new Date(`${date}T${startTime}:00`).toISOString();
      endIso = new Date(`${date}T${endTime}:00`).toISOString();
    }
    setLocalError(null);

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
      location: String(data.get("location")) as "home" | "office",
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
      links: links.filter((link) => link.url.trim()),
    };

    onSave(input, block?.id);
  }

  return (
    <md-dialog ref={dialogRef} quick={quick || undefined} class={styles.dialog}>
      <div slot="headline" className={styles.headline}>
        <span>
          {readOnly
            ? "Journal entry"
            : block
              ? "Edit journal entry"
              : "New journal entry"}
        </span>
        <md-icon-button
          type="button"
          title="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>
      <form
        id="event-form"
        slot="content"
        className={styles.form}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Enter saves; but not inside a textarea (where it adds a newline).
          const tag = (e.target as HTMLElement).tagName;
          if (e.key === "Enter" && tag !== "TEXTAREA") {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
      >
        <div className={styles.columns}>
          <div className={styles.column}>
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
              handleAllDayChange((e.target as HTMLInputElement).checked)
            }
          />
          <span className="body-medium">
            All day (e.g. out of office, school)
          </span>
        </label>

        {allDay ? (
          <div className={styles.row}>
            <label className={`${styles.timeField} body-small`}>
              From
              <input
                type="date"
                value={date}
                disabled={readOnly}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className={`${styles.timeField} body-small`}>
              To
              <input
                type="date"
                value={endDate}
                disabled={readOnly}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className={styles.row}>
            <label className={`${styles.timeField} body-small`}>
              Date
              <input
                type="date"
                name="date"
                value={date}
                disabled={readOnly}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className={`${styles.timeField} body-small`}>
              From
              <select
                className={styles.timeSelect}
                value={startTime}
                disabled={readOnly}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.timeField} body-small`}>
              To
              <select
                className={styles.timeSelect}
                value={endTime}
                disabled={readOnly}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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
            required
            disabled={readOnly}
            value={block?.location ?? "office"}
          >
            <md-select-option value="office">
              <div slot="headline">Office</div>
            </md-select-option>
            <md-select-option value="home">
              <div slot="headline">Home office</div>
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
          </div>

          <div className={styles.column}>
        <Expandable
          label="Blockers & solutions"
          badge={blockerEntries.length}
          defaultOpen={!quick}
        >
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
                data-testid={`blocker-${index}`}
                type="textarea"
                rows={2}
                disabled={readOnly}
                placeholder="Blocker"
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
                data-testid={`solution-${index}`}
                type="textarea"
                rows={2}
                disabled={readOnly}
                placeholder="Solution steps"
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
              <md-icon slot="icon">add</md-icon>
              Add blocker
            </md-text-button>
          )}
          {readOnly && blockerEntries.length === 0 && (
            <p className={`${styles.groupLabel} body-small`}>No blockers.</p>
          )}
        </Expandable>

        <Expandable
          label="Links & more"
          badge={links.length}
          defaultOpen={!quick}
        >
          {links.map((link, index) => (
            <div key={index} className={styles.linkRow}>
              <md-outlined-select
                class={styles.linkType}
                label="Type"
                disabled={readOnly}
                value={link.type}
                onInput={(e: React.FormEvent) =>
                  setLinks((current) =>
                    current.map((l, i) =>
                      i === index
                        ? {
                            ...l,
                            type: (e.target as HTMLSelectElement)
                              .value as EventLink["type"],
                          }
                        : l,
                    ),
                  )
                }
              >
                {LINK_TYPES.map((t) => (
                  <md-select-option key={t.value} value={t.value}>
                    <div slot="headline">{t.label}</div>
                  </md-select-option>
                ))}
              </md-outlined-select>
              <md-outlined-text-field
                class={styles.linkUrl}
                label="Link"
                data-testid={`link-${index}`}
                disabled={readOnly}
                placeholder={
                  LINK_TYPES.find((t) => t.value === link.type)?.placeholder
                }
                value={link.url}
                onInput={(e: React.FormEvent) =>
                  setLinks((current) =>
                    current.map((l, i) =>
                      i === index
                        ? { ...l, url: (e.target as HTMLInputElement).value }
                        : l,
                    ),
                  )
                }
              />
              {!readOnly && (
                <md-icon-button
                  type="button"
                  title={`Remove link ${index + 1}`}
                  onClick={() =>
                    setLinks((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <md-icon>delete</md-icon>
                </md-icon-button>
              )}
            </div>
          ))}
          {!readOnly && (
            <md-text-button
              type="button"
              onClick={() =>
                setLinks((current) => [...current, { type: "go", url: "" }])
              }
            >
              <md-icon slot="icon">add</md-icon>
              Add link
            </md-text-button>
          )}
          {readOnly && links.length === 0 && (
            <p className={`${styles.groupLabel} body-small`}>No links.</p>
          )}
        </Expandable>
          </div>
        </div>

        {(localError || error) && (
          <p className={`${styles.error} body-medium`}>{localError || error}</p>
        )}
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
