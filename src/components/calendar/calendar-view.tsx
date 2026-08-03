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
  listBlocks,
  rescheduleBlock,
  updateBlock,
} from "@/server/blocks";
import { listProjects } from "@/server/projects";
import { DEFAULT_BLOCK_COLOR, type BlockInput } from "@/lib/blocks";
import { isLateEntry } from "@/lib/week";
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

function renderEvent(arg: EventContentArg) {
  const { event } = arg;
  const time = event.allDay
    ? "all day"
    : event.start && event.end
      ? `${timeFormat.format(event.start)} – ${timeFormat.format(event.end)}`
      : "";
  const location = event.extendedProps.location as
    | keyof typeof LOCATION_LABEL
    | null;
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
          {location ? LOCATION_LABEL[location] : null}
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
  // A single "now" for past/late checks, kept out of render impurity.
  const [now] = useState(() => Date.now());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

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
    queryKey: ["blocks", ownerKey, range?.start.toISOString()],
    enabled: !!range,
    queryFn: () =>
      listBlocks({
        start: range!.start.toISOString(),
        end: range!.end.toISOString(),
        apprenticeId: ownerId,
      }),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects", ownerKey],
    queryFn: () => listProjects(ownerId),
  });

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

  const events = useMemo(
    () =>
      (data ?? []).map((occurrence) => {
        const project = occurrence.projectId
          ? projectById.get(occurrence.projectId)
          : undefined;
        const color = occurrence.color ?? DEFAULT_BLOCK_COLOR;
        // Past entries fade to a pastel tint so it is clear what is done.
        const isPast = occurrence.end.getTime() < now;
        // Late = created/changed after its week's Friday 18:00 deadline.
        const isLate = isLateEntry(occurrence.updatedAt, occurrence.start);
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
            location: occurrence.location,
            projectName: project?.name ?? null,
            projectIcon: project?.icon ?? null,
            projectColor: project?.color ?? null,
            isLate,
            links: (occurrence.links ?? [])
              .map((link) => link.url)
              .filter(Boolean),
          },
        };
      }),
    [data, projectById, now],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["blocks", ownerKey] });

  // Clears the persisted selection mirror (unselectAuto is off).
  const clearSelection = useCallback(() => {
    calendarRef.current?.getApi().unselect();
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogError(null);
    clearSelection();
  }, [clearSelection]);

  const saveMutation = useMutation({
    mutationFn: ({ input, blockId }: { input: BlockInput; blockId?: string }) =>
      blockId ? updateBlock(blockId, input) : createBlock(input),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setDialogError(null);
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
      setDialogError(null);
      // Month-view selections are all-day; give them a default 09:00-10:00
      // timed slot on the first selected day.
      if (selection.allDay) {
        const day = new Date(selection.start);
        day.setHours(9, 0, 0, 0);
        setDialog({
          mode: "create",
          start: day,
          end: new Date(day.getTime() + 60 * 60 * 1000),
        });
        return;
      }
      setDialog({ mode: "create", start: selection.start, end: selection.end });
    },
    [readOnly],
  );

  // A tap on mobile, or a click on a day in month view, creates a one-hour
  // entry (at that time, or 09:00 for a whole-day cell).
  const handleDateClick = useCallback(
    (click: DateClickArg) => {
      if (readOnly) return;
      if (!isMobile && click.view.type !== "dayGridMonth") return;
      setDialogError(null);
      const start = new Date(click.date);
      if (click.allDay) {
        start.setHours(9, 0, 0, 0);
      }
      setDialog({
        mode: "create",
        start,
        end: new Date(start.getTime() + 60 * 60 * 1000),
      });
    },
    [readOnly, isMobile],
  );

  const handleEventClick = useCallback(
    (click: EventClickArg) => {
      const occurrence = occurrences.get(click.event.id);
      if (!occurrence) return;
      setDialogError(null);
      setDialog({ mode: "edit", occurrence });
    },
    [occurrences],
  );

  // The sidebar "Create" button dispatches this event (see CreateEventButton).
  useEffect(() => {
    if (readOnly) return;
    const handleCreate = () => {
      setDialogError(null);
      setDialog({ mode: "create", ...defaultCreateSlot() });
    };
    window.addEventListener("workjournal:create", handleCreate);
    return () => window.removeEventListener("workjournal:create", handleCreate);
  }, [readOnly]);

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

  const weekDays = useMemo(() => workweekOf(selectedDay), [selectedDay]);
  const today = new Date();

  function shiftWeek(direction: 1 | -1) {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + 7 * direction);
    setSelectedDay(next);
  }

  const dialogKey =
    dialog === null
      ? "closed"
      : dialog.mode === "edit"
        ? dialog.occurrence.occurrenceId
        : `create-${dialog.start.toISOString()}`;

  return (
    <>
      {title && <h1 className={`${styles.heading} headline-small`}>{title}</h1>}
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
          scrollTime="06:00:00"
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
          onClick={() => {
            setDialogError(null);
            setDialog({ mode: "create", ...defaultCreateSlot(selectedDay) });
          }}
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
          onClose={closeDialog}
          onSave={(input, blockId) => saveMutation.mutate({ input, blockId })}
          onDelete={(blockId) => deleteMutation.mutate(blockId)}
        />
      )}
    </>
  );
}
