"use client";

import { cloneElement, useEffect, useRef, useState } from "react";
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
  | { mode: "create"; start: Date; end: Date; allDay?: boolean }
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

// Quick suggestions for the specific work spot; free text is also allowed.
const SPOT_SUGGESTIONS = ["At my desk", "8th floor", "Meeting room"];

const LOCATION_LABEL: Record<"home" | "office", string> = {
  home: "Home",
  office: "Office",
};

const detailDateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const detailTimeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// One labelled line in the host's read-only entry view.
function DetailRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.detailRow}>
      <md-icon class={styles.detailIcon}>{icon}</md-icon>
      <div className={styles.detailBody}>
        <p className={`${styles.detailLabel} body-small`}>{label}</p>
        <div className={styles.detailValue}>{children}</div>
      </div>
    </div>
  );
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
  initialDayLocation,
  draft,
  onDraftChange,
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
  // The day-level home/office already set for this entry's date, if any.
  initialDayLocation?: "home" | "office" | null;
  // A live "draft" on the grid whose time this panel edits (create mode on
  // desktop). When present, the date/time fields are controlled by it, so
  // dragging/resizing the draft on the calendar and editing here stay in sync.
  draft?: { start: Date; end: Date; allDay: boolean } | null;
  onDraftChange?: (draft: { start: Date; end: Date; allDay: boolean }) => void;
  onClose: () => void;
  onSave: (
    input: BlockInput,
    blockId?: string,
    dayLocation?: "home" | "office",
  ) => void;
  onDelete: (blockId: string) => void;
}) {
  const dialogRef = useRef<MdDialog | null>(null);
  // Desktop shows a non-blocking side panel; mobile keeps the sheet dialog.
  const isPanel = !quick;
  const close = () => {
    if (isPanel) onClose();
    else dialogRef.current?.close();
  };
  const block = state.mode === "edit" ? state.occurrence : null;
  const [color, setColor] = useState<string>(
    block?.color ?? DEFAULT_BLOCK_COLOR,
  );
  const [projectId, setProjectId] = useState<string>(block?.projectId ?? "");
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const [dayLocation, setDayLocation] = useState<"home" | "office">(
    initialDayLocation ?? "office",
  );
  const [locationDetail, setLocationDetail] = useState<string>(
    block?.locationDetail ?? "",
  );
  const [blockerEntries, setBlockerEntries] = useState<BlockerEntry[]>(
    block?.blockerEntries?.length ? block.blockerEntries : [],
  );
  const [allDayI, setAllDayI] = useState<boolean>(
    block?.allDay ?? (state.mode === "create" ? (state.allDay ?? false) : false),
  );
  const [recurrence, setRecurrence] = useState<BlockInput["recurrence"]>(
    block?.recurrence ?? "none",
  );
  const [links, setLinks] = useState<EventLink[]>(block?.links ?? []);
  const [localError, setLocalError] = useState<string | null>(null);

  const start = state.mode === "edit" ? state.occurrence.start : state.start;
  const end = state.mode === "edit" ? state.occurrence.end : state.end;

  const [dateI, setDateI] = useState(toDateInput(start));
  const [endDateI, setEndDateI] = useState(toDateInput(end));
  const [startTimeI, setStartTimeI] = useState(snapTime(toTimeInput(start)));
  const [endTimeI, setEndTimeI] = useState(snapTime(toTimeInput(end)));

  // When a live grid draft drives the time (desktop create), the fields are
  // controlled by it; otherwise they use the internal state above.
  const controlled = !!draft && !!onDraftChange;

  // Combine a "YYYY-MM-DD" date and "HH:MM" time into a local Date.
  const combine = (d: string, t: string) => new Date(`${d}T${t}:00`);
  // The all-day "To" field shows the last included day; storage is exclusive,
  // so the stored end is one day past it.
  const exclusiveEnd = (lastDay: string) => {
    const d = new Date(`${lastDay}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d;
  };

  const allDay = controlled && draft ? draft.allDay : allDayI;
  const date = controlled && draft ? toDateInput(draft.start) : dateI;
  const endDate =
    controlled && draft
      ? toDateInput(
          draft.allDay
            ? new Date(draft.end.getTime() - 24 * 60 * 60 * 1000)
            : draft.end,
        )
      : endDateI;
  const startTime =
    controlled && draft ? snapTime(toTimeInput(draft.start)) : startTimeI;
  const endTime =
    controlled && draft ? snapTime(toTimeInput(draft.end)) : endTimeI;

  const setDate = (v: string) => {
    if (!draft || !onDraftChange) return setDateI(v);
    if (allDay) {
      onDraftChange({ start: combine(v, "00:00"), end: exclusiveEnd(endDate), allDay: true });
    } else {
      onDraftChange({ start: combine(v, startTime), end: combine(v, endTime), allDay: false });
    }
  };
  const setEndDate = (v: string) => {
    if (!draft || !onDraftChange) return setEndDateI(v);
    onDraftChange({ start: combine(date, "00:00"), end: exclusiveEnd(v), allDay: true });
  };
  const setStartTime = (v: string) => {
    if (!draft || !onDraftChange) return setStartTimeI(v);
    onDraftChange({ start: combine(date, v), end: combine(date, endTime), allDay: false });
  };
  const setEndTime = (v: string) => {
    if (!draft || !onDraftChange) return setEndTimeI(v);
    onDraftChange({ start: combine(date, startTime), end: combine(date, v), allDay: false });
  };

  // Switching an all-day event to a timed one: if the derived times collapse
  // to the same value (00:00-00:00), pick a sensible one-hour slot instead.
  function handleAllDayChange(checked: boolean) {
    if (draft && onDraftChange) {
      if (checked) {
        onDraftChange({ start: combine(date, "00:00"), end: exclusiveEnd(date), allDay: true });
      } else {
        onDraftChange({ start: combine(date, "09:00"), end: combine(date, "10:00"), allDay: false });
      }
      return;
    }
    setAllDayI(checked);
    if (!checked && startTime === endTime) {
      const newStart = startTime === "00:00" ? "09:00" : startTime;
      setStartTimeI(newStart);
      setEndTimeI(addHour(newStart));
    }
  }

  useEffect(() => {
    // The side panel is a plain element; only the mobile sheet needs the
    // md-dialog show/lock lifecycle.
    if (isPanel) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.show();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleClosed = () => onClose();
    dialog.addEventListener("closed", handleClosed);
    return () => {
      dialog.removeEventListener("closed", handleClosed);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, isPanel]);

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
      // The calendar view overrides this with the current mode (log/plan).
      kind: "log",
      title: String(data.get("title") ?? ""),
      start: startIso,
      end: endIso,
      allDay,
      description: String(data.get("description") ?? "") || undefined,
      projectId: projectId || null,
      blockerEntries: blockerEntries.filter(
        (entry) => entry.blocker.trim() || entry.solutionSteps.trim(),
      ),
      locationDetail: locationDetail.trim() || null,
      // A project's colour wins; a colour is only picked for project-less
      // entries.
      color: selectedProject
        ? (selectedProject.color as BlockInput["color"])
        : color,
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

    onSave(input, block?.id, dayLocation);
  }

  const headline = (
    <div className={styles.headline}>
      <span>
        {readOnly
          ? (block?.title ?? "Journal entry")
          : block
            ? "Edit journal entry"
            : "New journal entry"}
      </span>
      <md-icon-button type="button" title="Close" onClick={close}>
        <md-icon>close</md-icon>
      </md-icon-button>
    </div>
  );

  // Host's read-only view: a clean summary of what the apprentice entered,
  // rather than a form full of disabled fields.
  const dayLoc = initialDayLocation ?? block?.location ?? null;
  const locationParts = [
    dayLoc ? LOCATION_LABEL[dayLoc] : null,
    block?.locationDetail,
  ].filter(Boolean);
  const lastAllDay = block
    ? new Date(block.end.getTime() - 24 * 60 * 60 * 1000)
    : null;
  const readOnlyDetails = block ? (
    <div className={styles.details}>
      <DetailRow icon="schedule" label="When">
        {block.allDay
          ? `All day · ${detailDateFmt.format(block.start)}${
              lastAllDay &&
              detailDateFmt.format(lastAllDay) !==
                detailDateFmt.format(block.start)
                ? ` – ${detailDateFmt.format(lastAllDay)}`
                : ""
            }`
          : `${detailDateFmt.format(block.start)} · ${detailTimeFmt.format(
              block.start,
            )} – ${detailTimeFmt.format(block.end)}`}
      </DetailRow>
      {selectedProject && (
        <DetailRow icon="folder" label="Project">
          <span className={styles.detailProject}>
            {selectedProject.icon ? (
              <md-icon
                class={styles.chipIcon}
                style={{ color: selectedProject.color }}
              >
                {selectedProject.icon}
              </md-icon>
            ) : (
              <span
                className={styles.chipDot}
                style={{ background: selectedProject.color }}
              />
            )}
            {selectedProject.name}
          </span>
        </DetailRow>
      )}
      {locationParts.length > 0 && (
        <DetailRow icon="place" label="Location">
          {locationParts.join(" · ")}
        </DetailRow>
      )}
      {block.description && (
        <DetailRow icon="notes" label="Description">
          {block.description}
        </DetailRow>
      )}
      {block.blockerEntries.length > 0 && (
        <DetailRow icon="report" label="Blockers & solutions">
          <div className={styles.detailBlockers}>
            {block.blockerEntries.map((entry, index) => (
              <div key={index} className={styles.detailBlocker}>
                <p className="body-medium">{entry.blocker}</p>
                {entry.solutionSteps && (
                  <p className={`${styles.detailSolution} body-small`}>
                    → {entry.solutionSteps}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DetailRow>
      )}
      {block.links.length > 0 && (
        <DetailRow icon="link" label="Links">
          <div className={styles.detailLinks}>
            {block.links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className={styles.detailLink}
              >
                {link.url}
              </a>
            ))}
          </div>
        </DetailRow>
      )}
    </div>
  ) : null;

  const editableBody = (
      <form
        id="event-form"
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

        {projects.length > 0 && (
          <div>
            <p className={`${styles.groupLabel} body-small`}>Project</p>
            <div
              className={styles.chipRow}
              role="radiogroup"
              aria-label="Project"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!projectId}
                disabled={readOnly}
                className={!projectId ? styles.chipSelected : styles.chip}
                onClick={() => setProjectId("")}
              >
                No project
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={projectId === p.id}
                  disabled={readOnly}
                  className={
                    projectId === p.id ? styles.chipSelected : styles.chip
                  }
                  onClick={() => setProjectId(p.id)}
                >
                  {p.icon ? (
                    <md-icon class={styles.chipIcon} style={{ color: p.color }}>
                      {p.icon}
                    </md-icon>
                  ) : (
                    <span
                      className={styles.chipDot}
                      style={{ background: p.color }}
                    />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className={`${styles.groupLabel} body-small`}>
            Work location that day
          </p>
          <div className={styles.chipRow} role="radiogroup" aria-label="Day location">
            {(["office", "home"] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                role="radio"
                aria-checked={dayLocation === loc}
                disabled={readOnly}
                className={dayLocation === loc ? styles.chipSelected : styles.chip}
                onClick={() => setDayLocation(loc)}
              >
                <md-icon class={styles.chipIcon}>
                  {loc === "home" ? "home" : "apartment"}
                </md-icon>
                {loc === "home" ? "Home" : "Office"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.spotGroup}>
          <p className={`${styles.groupLabel} body-small`}>Spot (optional)</p>
          <div className={styles.chipRow}>
            {SPOT_SUGGESTIONS.map((spot) => (
              <button
                key={spot}
                type="button"
                disabled={readOnly}
                className={
                  locationDetail === spot ? styles.chipSelected : styles.chip
                }
                onClick={() => setLocationDetail(spot)}
              >
                {spot}
              </button>
            ))}
          </div>
          <md-outlined-text-field
            label="Where exactly"
            value={locationDetail}
            disabled={readOnly}
            onInput={(e: React.FormEvent) =>
              setLocationDetail((e.target as HTMLInputElement).value)
            }
          />
        </div>

        <div className={styles.row}>
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

        {selectedProject ? (
          <p className={`${styles.groupLabel} body-small`}>
            Colour inherited from {selectedProject.name}
          </p>
        ) : (
          <div>
            <p className={`${styles.groupLabel} body-small`}>Color</p>
            <div
              className={styles.colorGroup}
              role="radiogroup"
              aria-label="Color"
            >
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
        )}
          </div>

          <div className={styles.column}>
        <Expandable
          label="Blockers & solutions"
          badge={blockerEntries.length}
          defaultOpen={false}
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
          defaultOpen={false}
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
  );

  // Hosts see the clean summary; the apprentice sees the editable form.
  const body = readOnly && readOnlyDetails ? readOnlyDetails : editableBody;

  const footer = (
      <div className={styles.actions}>
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
        <md-text-button type="button" onClick={close}>
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
  );

  if (isPanel) {
    return (
      <aside
        className={styles.sidePanel}
        role="dialog"
        aria-modal="false"
        aria-label="Journal entry"
      >
        {headline}
        {body}
        {footer}
      </aside>
    );
  }

  return (
    <md-dialog ref={dialogRef} quick={quick || undefined} class={styles.dialog}>
      {cloneElement(headline, { slot: "headline" })}
      {cloneElement(body, { slot: "content" })}
      {cloneElement(footer, { slot: "actions" })}
    </md-dialog>
  );
}
