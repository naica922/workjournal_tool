"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  DayHeaderContentArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import {
  createBlock,
  deleteBlock,
  isDailySubmissionRequired,
  listBlocks,
  listDayLocations,
  rescheduleBlock,
  setDayLocation,
  updateBlock,
} from "@/server/blocks";
import { listProjects } from "@/server/projects";
import { DEFAULT_BLOCK_COLOR, type BlockInput } from "@/lib/blocks";
import { fridayCutoff, isLateEntry, nextDailyDeadline } from "@/lib/week";
import type { BlockOccurrence } from "@/lib/recurrence";
import { EventDialog, type DialogState } from "./event-dialog";
import styles from "./calendar-view.module.css";
import "./calendar.css";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const LOCATION_LABEL = { home: "Home", office: "Office" } as const;

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderEvent(arg: EventContentArg) {
  const { event } = arg;
  const time = event.allDay
    ? "all day"
    : event.start && event.end
      ? `${timeFormat.format(event.start)} – ${timeFormat.format(event.end)}`
      : "";
  const dayLocation = event.extendedProps.dayLocation as
    | keyof typeof LOCATION_LABEL
    | null;
  const locationDetail = event.extendedProps.locationDetail as string | null;
  // Prefer the specific spot; fall back to the day's home/office label.
  const location =
    locationDetail || (dayLocation ? LOCATION_LABEL[dayLocation] : null);
  const projectName = event.extendedProps.projectName as string | null;
  const projectIcon = event.extendedProps.projectIcon as string | null;
  const links = (event.extendedProps.links as string[]) ?? [];
  const isLate = event.extendedProps.isLate as boolean;
  // Flags an entry added or changed after its week's Friday 18:00 deadline.
  const lateMark = isLate ? (
    <span
      className="wj-late"
      title="Added or changed after the weekly deadline (Fri 18:00)"
    >
      <md-icon class="wj-late-icon">history</md-icon>
    </span>
  ) : null;
  // Month cells fit one line: just the title next to the time.
  if (arg.view.type === "dayGridMonth" && !event.allDay) {
    return (
      <div className="wj-event wj-event--allday" title={event.title}>
        {lateMark}
        <span className="wj-event-title">{event.title}</span>
        <span className="wj-event-meta">
          {event.start ? timeFormat.format(event.start) : ""}
        </span>
      </div>
    );
  }
  // All-day bars are a single compact line; timed blocks stack their lines
  // like the mock (title, time, location, then a links pill).
  return (
    <div
      className={event.allDay ? "wj-event wj-event--allday" : "wj-event"}
      title={event.title}
    >
      <span className="wj-event-title">
        {lateMark}
        {event.title}
      </span>
      <span className="wj-event-meta">{time}</span>
      {(location || projectName) && !event.allDay && (
        <span className="wj-event-meta">
          {location}
          {location && projectName ? " · " : null}
          {projectName ? (
            <>
              {projectIcon && (
                <md-icon class="wj-event-project-icon">{projectIcon}</md-icon>
              )}
              {projectName}
            </>
          ) : null}
        </span>
      )}
      {/* The pill appears only when the block is tall enough (CSS clamps it) */}
      {links.length > 0 && !event.allDay && (
        <span className="wj-event-pill">
          {links.length} {links.length === 1 ? "link" : "links"}
        </span>
      )}
    </div>
  );
}

function renderDayHeader(arg: DayHeaderContentArg) {
  const weekday = arg.date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  return (
    <div className="wj-day-header">
      <span className="wj-day-name">{weekday}</span>
      <span className={arg.isToday ? "wj-day-num wj-day-today" : "wj-day-num"}>
        {arg.date.getDate()}
      </span>
    </div>
  );
}

// Default slot for the sidebar "Create" button: the next full hour today.
function defaultCreateSlot(day?: Date) {
  const start = day ? new Date(day) : new Date();
  const now = new Date();
  start.setHours(now.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

// Monday to friday of the week containing the given date.
function workweekOf(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MOBILE_QUERY = "(max-width: 700px)";

// Id of the live "draft" event shown on the grid while creating an entry, so
// it can be dragged/resized before it is saved (Google-Calendar style).
const DRAFT_ID = "__wj_draft__";

function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(MOBILE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export function CalendarView({
  ownerId,
  readOnly = false,
  title,
  minDate,
  embedded = false,
}: {
  // Calendar owner; undefined shows the signed-in user's own calendar.
  ownerId?: string;
  readOnly?: boolean;
  title?: string;
  // Earliest navigable/creatable day (the apprenticeship start date).
  minDate?: string | null;
  // Embedded below other panels (e.g. the host view): fixed height so the
  // page scrolls instead of the calendar filling the whole viewport.
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const ownerKey = ownerId ?? "me";
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar | null>(null);
  // Guards the one-time "scroll to now" so navigating weeks doesn't re-scroll.
  const didInitialScroll = useRef(false);
  // A single "now" for past/late checks, kept out of render impurity.
  const [now] = useState(() => Date.now());
  // Where the grid is scrolled to on first render: the current hour (minus a
  // little context), so a reload lands on "now". Computed once and kept
  // constant so later re-renders (e.g. opening the create panel) never yank
  // the grid back — the user's manual scrolling is preserved.
  const [initialScrollTime] = useState(() => {
    const hour = Math.max(0, new Date().getHours() - 1);
    return `${String(hour).padStart(2, "0")}:00:00`;
  });
  // "log" = this week's journal; "plan" = next week's high-level plan.
  const [mode, setMode] = useState<"log" | "plan">("log");
  // Ticks every 30s so the submission countdown stays live.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // The live, still-unsaved entry shown on the grid during creation on
  // desktop, so it can be dragged/resized while the side panel is open.
  const [draft, setDraft] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);

  // Mobile always shows the single-day view; desktop keeps whatever view the
  // user picked (week or month) and only resets when coming from mobile.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (isMobile) {
      api.changeView("timeGridDay");
      api.gotoDate(selectedDay);
    } else if (api.view.type === "timeGridDay") {
      api.changeView("timeGridWeek");
    }
    api.scrollToTime("06:00:00");
  }, [isMobile, selectedDay]);

  const { data, isPending } = useQuery({
    queryKey: ["blocks", ownerKey, mode, range?.start.toISOString()],
    enabled: !!range,
    queryFn: () =>
      listBlocks({
        start: range!.start.toISOString(),
        end: range!.end.toISOString(),
        apprenticeId: ownerId,
        kind: mode,
      }),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects", ownerKey],
    queryFn: () => listProjects(ownerId),
  });

  const { data: dailyRequired = false } = useQuery({
    queryKey: ["daily-submission", ownerKey],
    queryFn: () => isDailySubmissionRequired(ownerId),
  });

  const { data: dayLocations } = useQuery({
    queryKey: ["day-locations", ownerKey, range?.start.toISOString()],
    enabled: !!range,
    queryFn: () =>
      listDayLocations({
        start: isoDay(range!.start),
        end: isoDay(range!.end),
        apprenticeId: ownerId,
      }),
  });

  const dayLocByDate = useMemo(() => {
    const map = new Map<string, "home" | "office">();
    for (const d of dayLocations ?? []) {
      map.set(d.date, d.location as "home" | "office");
    }
    return map;
  }, [dayLocations]);

  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  );

  const occurrences = useMemo(() => {
    const map = new Map<string, BlockOccurrence>();
    for (const occurrence of data ?? []) {
      map.set(occurrence.occurrenceId, occurrence);
    }
    return map;
  }, [data]);

  const events = useMemo(() => {
    const base = (data ?? []).map((occurrence) => {
        const project = occurrence.projectId
          ? projectById.get(occurrence.projectId)
          : undefined;
        // A project's colour wins so its blocks read as one group.
        const color =
          project?.color ?? occurrence.color ?? DEFAULT_BLOCK_COLOR;
        // Past entries fade to a pastel tint so it is clear what is done.
        const isPast = occurrence.end.getTime() < now;
        // Late = created/changed after its seal deadline (the day's 18:00 when
        // daily submission is required, otherwise the week's Friday 18:00).
        const isLate = isLateEntry(
          occurrence.updatedAt,
          occurrence.start,
          dailyRequired,
        );
        return {
          id: occurrence.occurrenceId,
          title: occurrence.title,
          start: occurrence.start,
          end: occurrence.end,
          allDay: occurrence.allDay,
          backgroundColor: isPast
            ? `color-mix(in srgb, ${color} 30%, white)`
            : color,
          borderColor: "transparent",
          classNames: [
            ...(isPast ? ["wj-past"] : []),
            ...(isLate ? ["wj-late-event"] : []),
          ],
          extendedProps: {
            // Day-level home/office (falls back to the old per-block value).
            dayLocation:
              dayLocByDate.get(isoDay(occurrence.start)) ??
              occurrence.location ??
              null,
            locationDetail: occurrence.locationDetail ?? null,
            projectName: project?.name ?? null,
            projectIcon: project?.icon ?? null,
            projectColor: project?.color ?? null,
            isLate,
            links: (occurrence.links ?? [])
              .map((link) => link.url)
              .filter(Boolean),
          },
        };
      });

    // The live draft (desktop create) rides along as an editable event so it
    // can be dragged/resized on the grid before it is saved.
    if (draft) {
      base.push({
        id: DRAFT_ID,
        title: mode === "plan" ? "New plan entry" : "New entry",
        start: draft.start,
        end: draft.end,
        allDay: draft.allDay,
        backgroundColor: DEFAULT_BLOCK_COLOR,
        borderColor: "transparent",
        classNames: ["wj-draft"],
        extendedProps: {
          dayLocation: null,
          locationDetail: null,
          projectName: null,
          projectIcon: null,
          projectColor: null,
          isLate: false,
          links: [],
        },
      });
    }
    return base;
  }, [data, projectById, now, dayLocByDate, draft, mode, dailyRequired]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["blocks", ownerKey] });
    queryClient.invalidateQueries({ queryKey: ["day-locations", ownerKey] });
  };

  // Clears the persisted selection mirror (unselectAuto is off).
  const clearSelection = useCallback(() => {
    calendarRef.current?.getApi().unselect();
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogError(null);
    setDraft(null);
    clearSelection();
  }, [clearSelection]);

  // Start creating an entry. On desktop, timed creates also drop a live draft
  // event on the grid so it can be dragged/resized while the panel is open;
  // all-day and mobile creates keep the plain dialog with no grid draft.
  const beginCreate = useCallback(
    (slot: { start: Date; end: Date; allDay?: boolean }) => {
      setDialogError(null);
      setDialog({ mode: "create", ...slot });
      if (!isMobile && !slot.allDay) {
        setDraft({ start: slot.start, end: slot.end, allDay: false });
        clearSelection();
      } else {
        setDraft(null);
      }
    },
    [isMobile, clearSelection],
  );

  const saveMutation = useMutation({
    mutationFn: async ({
      input,
      blockId,
      dayLocation,
    }: {
      input: BlockInput;
      blockId?: string;
      dayLocation?: "home" | "office";
    }) => {
      const saved = blockId
        ? await updateBlock(blockId, input)
        : await createBlock(input);
      // A timed entry also records that day's home/office choice.
      if (dayLocation && !input.allDay && !readOnly) {
        await setDayLocation(isoDay(new Date(input.start)), dayLocation);
      }
      return saved;
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setDialogError(null);
      setDraft(null);
      clearSelection();
    },
    onError: (error: Error) => setDialogError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (blockId: string) => deleteBlock(blockId),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setDialogError(null);
      setDraft(null);
    },
    onError: (error: Error) => setDialogError(error.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({
      blockId,
      startDeltaMs,
      endDeltaMs,
    }: {
      blockId: string;
      startDeltaMs: number;
      endDeltaMs: number;
    }) => rescheduleBlock(blockId, startDeltaMs, endDeltaMs),
    onSuccess: invalidate,
    // On failure FullCalendar's own revert already restored the event.
    onError: () => invalidate(),
  });

  // Drag to another time (eventDrop) or resize to extend (eventResize):
  // shift the underlying block by the delta. Recurring series move together.
  const handleEventChange = useCallback(
    (info: EventDropArg | EventResizeDoneArg) => {
      // Dragging/resizing the live draft just updates the pending times; it is
      // not a saved block yet, so it must not be reverted.
      if (info.event.id === DRAFT_ID) {
        const start = info.event.start ?? new Date();
        const end =
          info.event.end ?? new Date(start.getTime() + 60 * 60 * 1000);
        setDraft({ start, end, allDay: info.event.allDay });
        return;
      }
      const occurrence = occurrences.get(info.event.id);
      if (!occurrence) {
        info.revert();
        return;
      }
      const oldStart = info.oldEvent.start?.getTime() ?? 0;
      const oldEnd = info.oldEvent.end?.getTime() ?? 0;
      const newStart = info.event.start?.getTime() ?? oldStart;
      const newEnd = info.event.end?.getTime() ?? oldEnd;
      rescheduleMutation.mutate({
        blockId: occurrence.id,
        startDeltaMs: newStart - oldStart,
        endDeltaMs: newEnd - oldEnd,
      });
    },
    [occurrences, rescheduleMutation],
  );

  const handleSelect = useCallback(
    (selection: DateSelectArg) => {
      if (readOnly) return;
      // Month-view selections are all-day; give them a default 09:00-10:00
      // timed slot on the first selected day.
      if (selection.allDay) {
        // FullCalendar's all-day end is exclusive; the last included day is
        // one day before it.
        const startDay = new Date(selection.start);
        const lastDay = new Date(selection.end);
        lastDay.setDate(lastDay.getDate() - 1);
        const spansDays = lastDay.getTime() > startDay.getTime();
        const isMonth = selection.view.type === "dayGridMonth";
        // A single day tapped in the month grid becomes a timed slot; the
        // all-day row (or any multi-day drag) becomes an all-day OOO entry.
        if (isMonth && !spansDays) {
          const day = new Date(selection.start);
          day.setHours(9, 0, 0, 0);
          beginCreate({ start: day, end: new Date(day.getTime() + 60 * 60 * 1000) });
          return;
        }
        beginCreate({ start: startDay, end: lastDay, allDay: true });
        return;
      }
      beginCreate({ start: selection.start, end: selection.end });
    },
    [readOnly, beginCreate],
  );

  // A tap on mobile, or a click on a day in month view, creates a one-hour
  // entry (at that time, or 09:00 for a whole-day cell).
  const handleDateClick = useCallback(
    (click: DateClickArg) => {
      if (readOnly) return;
      if (!isMobile && click.view.type !== "dayGridMonth") return;
      const start = new Date(click.date);
      if (click.allDay) {
        start.setHours(9, 0, 0, 0);
      }
      beginCreate({ start, end: new Date(start.getTime() + 60 * 60 * 1000) });
    },
    [readOnly, isMobile, beginCreate],
  );

  const handleEventClick = useCallback(
    (click: EventClickArg) => {
      const occurrence = occurrences.get(click.event.id);
      if (!occurrence) return;
      setDialogError(null);
      setDraft(null);
      setDialog({ mode: "edit", occurrence });
    },
    [occurrences],
  );

  // The sidebar "Create" button dispatches this event (see CreateEventButton).
  useEffect(() => {
    if (readOnly) return;
    const handleCreate = () => beginCreate(defaultCreateSlot());
    window.addEventListener("workjournal:create", handleCreate);
    return () => window.removeEventListener("workjournal:create", handleCreate);
  }, [readOnly, beginCreate]);

  // The sidebar mini month emits this; jump the main calendar there.
  useEffect(() => {
    const handleGoto = (event: Event) => {
      const date = new Date((event as CustomEvent<number>).detail);
      setSelectedDay(date);
      calendarRef.current?.getApi().gotoDate(date);
    };
    window.addEventListener("workjournal:goto-date", handleGoto);
    return () => window.removeEventListener("workjournal:goto-date", handleGoto);
  }, []);

  // When arriving from another tab's mini month (/?date=YYYY-MM-DD), jump
  // the calendar to that day on mount by re-using the goto-date event (its
  // listener is registered by the effect above).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("date");
    if (!param) return;
    const date = new Date(`${param}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    window.dispatchEvent(
      new CustomEvent("workjournal:goto-date", { detail: date.getTime() }),
    );
  }, []);

  // Keep the countdown ticking (setState in a timer, not in the effect body).
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Scroll the grid to the current time once, after the first load, so a
  // reload lands on "now". Done imperatively as the last scroll (scrollTimeReset
  // is off, so the grid never jumps back when events change afterwards).
  useEffect(() => {
    if (didInitialScroll.current || isPending) return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    didInitialScroll.current = true;
    // Shortly after, so the timegrid scroller exists and this wins any scroll
    // FullCalendar applied while rendering the freshly loaded events.
    const id = setTimeout(() => api.scrollToTime(initialScrollTime), 200);
    return () => clearTimeout(id);
  }, [isPending, initialScrollTime]);

  const weekDays = useMemo(() => workweekOf(selectedDay), [selectedDay]);
  const today = new Date();

  function shiftWeek(direction: 1 | -1) {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + 7 * direction);
    setSelectedDay(next);
  }

  // Switching mode also moves the calendar: plan is always next week.
  function switchMode(next: "log" | "plan") {
    setMode(next);
    const target = new Date();
    if (next === "plan") target.setDate(target.getDate() + 7);
    setSelectedDay(target);
    calendarRef.current?.getApi().gotoDate(target);
  }

  // Time left until the next seal. With daily submission that is the next
  // workday 18:00; otherwise this Friday 18:00 (or next week's if past).
  const deadline = dailyRequired
    ? nextDailyDeadline(new Date(nowTick)).getTime()
    : (() => {
        const base = fridayCutoff(new Date(nowTick)).getTime();
        return base > nowTick ? base : base + 7 * 24 * 60 * 60 * 1000;
      })();
  const msLeft = Math.max(0, deadline - nowTick);
  const countdown = (() => {
    const totalMin = Math.floor(msLeft / 60000);
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    const m = totalMin % 60;
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  })();

  const dialogKey =
    dialog === null
      ? "closed"
      : dialog.mode === "edit"
        ? dialog.occurrence.occurrenceId
        : `create-${dialog.start.toISOString()}`;

  return (
    <>
      {title && <h1 className={`${styles.heading} headline-small`}>{title}</h1>}

      <div className={styles.modeBar}>
        <div className={styles.modeToggle} role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "log"}
            className={mode === "log" ? styles.modeActive : styles.modeButton}
            onClick={() => switchMode("log")}
          >
            Log · this week
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "plan"}
            className={mode === "plan" ? styles.modeActive : styles.modeButton}
            onClick={() => switchMode("plan")}
          >
            Plan · next week
          </button>
        </div>
        {!readOnly && (
          <span
            className={`${dailyRequired ? styles.submitNoteUrgent : styles.submitNote} body-small`}
          >
            <md-icon class={styles.submitIcon}>
              {dailyRequired ? "warning" : "schedule"}
            </md-icon>
            {mode === "plan" ? "Plan next week at a high level. " : ""}
            {dailyRequired
              ? `Daily submission required by your host — today's entries lock at 18:00 · ${countdown} left`
              : `Auto-submits Friday 18:00 · ${countdown} left`}
          </span>
        )}
      </div>

      {isMobile && (
        <div className={styles.dayStrip}>
          <button
            type="button"
            className={styles.stripArrow}
            aria-label="Previous week"
            onClick={() => shiftWeek(-1)}
          >
            <md-icon>chevron_left</md-icon>
          </button>
          {weekDays.map((day) => {
            const selected = isSameDay(day, selectedDay);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                className={styles.stripDay}
                aria-pressed={selected}
                onClick={() => setSelectedDay(day)}
              >
                <span
                  className={
                    isToday ? styles.stripNameToday : styles.stripName
                  }
                >
                  {day
                    .toLocaleDateString("en-US", { weekday: "short" })
                    .toUpperCase()}
                </span>
                <span
                  className={
                    selected
                      ? styles.stripNumSelected
                      : isToday
                        ? styles.stripNumToday
                        : styles.stripNum
                  }
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={styles.stripArrow}
            aria-label="Next week"
            onClick={() => shiftWeek(1)}
          >
            <md-icon>chevron_right</md-icon>
          </button>
        </div>
      )}
      <div
        className={styles.wrapper}
        style={embedded ? { flex: "none", height: "40rem" } : undefined}
      >
        {isPending && (
          <div className={styles.loading} role="status" aria-label="Loading">
            <md-circular-progress indeterminate />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          // Block navigating/creating before the apprenticeship start date.
          validRange={minDate ? { start: minDate } : undefined}
          headerToolbar={
            isMobile
              ? false
              : {
                  left: "today prev next title",
                  center: "",
                  right: "timeGridWeek,dayGridMonth",
                }
          }
          buttonText={{
            today: "Today",
            week: "Week",
            month: "Month",
          }}
          views={{
            dayGridMonth: {
              titleFormat: { year: "numeric", month: "long" },
              fixedWeekCount: false,
            },
          }}
          titleFormat={{ year: "numeric", month: "long", day: "numeric" }}
          firstDay={1}
          hiddenDays={[0, 6]}
          dayHeaders={!isMobile}
          allDaySlot
          // Full 24 hours; the view opens scrolled to the work day but can be
          // scrolled up to 00:00 and down to the evening.
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime={initialScrollTime}
          // Don't yank the grid back to scrollTime when events change (e.g. the
          // create draft); the initial scroll-to-now is done imperatively below.
          scrollTimeReset={false}
          snapDuration="00:15:00"
          nowIndicator
          selectable={!readOnly}
          selectMirror
          // Keep the selection highlight until the dialog is dismissed.
          unselectAuto={false}
          // On touch, a long press starts a drag-selection so normal touch
          // still scrolls the calendar.
          selectLongPressDelay={350}
          eventLongPressDelay={350}
          editable={!readOnly}
          eventStartEditable={!readOnly}
          eventDurationEditable={!readOnly}
          events={events}
          // Month view renders timed events as filled chips, not dot rows
          eventDisplay="block"
          select={handleSelect}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventChange}
          eventResize={handleEventChange}
          datesSet={(dates) =>
            setRange((current) =>
              current?.start.getTime() === dates.view.activeStart.getTime()
                ? current
                : { start: dates.view.activeStart, end: dates.view.activeEnd },
            )
          }
          eventContent={renderEvent}
          dayHeaderContent={renderDayHeader}
          displayEventTime={false}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          height="100%"
        />
      </div>
      {isMobile && !readOnly && (
        <button
          type="button"
          className={styles.fab}
          aria-label="Create journal entry"
          onClick={() => beginCreate(defaultCreateSlot(selectedDay))}
        >
          <md-icon>add</md-icon>
        </button>
      )}
      {dialog && (
        <EventDialog
          key={dialogKey}
          state={dialog}
          quick={isMobile}
          projects={projects ?? []}
          readOnly={readOnly}
          pending={saveMutation.isPending || deleteMutation.isPending}
          error={dialogError}
          initialDayLocation={dayLocByDate.get(
            isoDay(
              dialog.mode === "edit" ? dialog.occurrence.start : dialog.start,
            ),
          )}
          draft={dialog.mode === "create" ? draft : null}
          onDraftChange={setDraft}
          onClose={closeDialog}
          onSave={(input, blockId, dayLocation) =>
            saveMutation.mutate({
              input: { ...input, kind: mode },
              blockId,
              dayLocation,
            })
          }
          onDelete={(blockId) => deleteMutation.mutate(blockId)}
        />
      )}
    </>
  );
}
