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
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  DayHeaderContentArg,
} from "@fullcalendar/core";
import {
  createBlock,
  deleteBlock,
  listBlocks,
  updateBlock,
} from "@/server/blocks";
import { DEFAULT_BLOCK_COLOR, type BlockInput } from "@/lib/blocks";
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

// Blocks render like the mock: pastel background, dark text.
function pastel(color: string) {
  return `color-mix(in srgb, ${color} 30%, white)`;
}

function renderEvent(arg: EventContentArg) {
  const { event } = arg;
  const time =
    event.start && event.end
      ? `${timeFormat.format(event.start)} – ${timeFormat.format(event.end)}`
      : "";
  const location = event.extendedProps.location as
    | keyof typeof LOCATION_LABEL
    | null;
  return (
    <div className="wj-event">
      <span className="wj-event-title">{event.title}</span>{" "}
      <span className="wj-event-meta">
        {time}
        {location ? ` · ${LOCATION_LABEL[location]}` : ""}
      </span>
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
}: {
  // Calendar owner; undefined shows the signed-in user's own calendar.
  ownerId?: string;
  readOnly?: boolean;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const ownerKey = ownerId ?? "me";
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Switch between the desktop week view and the mobile day view (mock).
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(isMobile ? "timeGridDay" : "timeGridWeek");
    if (isMobile) {
      api.gotoDate(selectedDay);
    }
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

  const occurrences = useMemo(() => {
    const map = new Map<string, BlockOccurrence>();
    for (const occurrence of data ?? []) {
      map.set(occurrence.occurrenceId, occurrence);
    }
    return map;
  }, [data]);

  const events = useMemo(
    () =>
      (data ?? []).map((occurrence) => ({
        id: occurrence.occurrenceId,
        title: occurrence.title,
        start: occurrence.start,
        end: occurrence.end,
        backgroundColor: pastel(occurrence.color ?? DEFAULT_BLOCK_COLOR),
        borderColor: "transparent",
        textColor: "#1f1f1f",
        extendedProps: { location: occurrence.location },
      })),
    [data],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["blocks", ownerKey] });

  const saveMutation = useMutation({
    mutationFn: ({ input, blockId }: { input: BlockInput; blockId?: string }) =>
      blockId ? updateBlock(blockId, input) : createBlock(input),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      setDialogError(null);
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

  const handleSelect = useCallback(
    (selection: DateSelectArg) => {
      if (readOnly) return;
      setDialogError(null);
      setDialog({ mode: "create", start: selection.start, end: selection.end });
    },
    [readOnly],
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
      <div className={styles.wrapper}>
        {isPending && (
          <div className={styles.loading} role="status" aria-label="Loading">
            <md-circular-progress indeterminate />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={
            isMobile
              ? false
              : { left: "today prev next title", center: "", right: "" }
          }
          titleFormat={{ year: "numeric", month: "long", day: "numeric" }}
          firstDay={1}
          hiddenDays={[0, 6]}
          dayHeaders={!isMobile}
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          nowIndicator
          selectable={!readOnly}
          selectMirror
          events={events}
          select={handleSelect}
          eventClick={handleEventClick}
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
          height="auto"
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
          readOnly={readOnly}
          pending={saveMutation.isPending || deleteMutation.isPending}
          error={dialogError}
          onClose={() => {
            setDialog(null);
            setDialogError(null);
          }}
          onSave={(input, blockId) => saveMutation.mutate({ input, blockId })}
          onDelete={(blockId) => deleteMutation.mutate(blockId)}
        />
      )}
    </>
  );
}
