"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";
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
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

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
        backgroundColor: occurrence.color ?? DEFAULT_BLOCK_COLOR,
        borderColor: "transparent",
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

  const dialogKey =
    dialog === null
      ? "closed"
      : dialog.mode === "edit"
        ? dialog.occurrence.occurrenceId
        : `create-${dialog.start.toISOString()}`;

  return (
    <>
      {title && <h1 className={`${styles.heading} headline-small`}>{title}</h1>}
      <div className={styles.wrapper}>
        {isPending && (
          <div className={styles.loading} role="status" aria-label="Loading">
            <md-circular-progress indeterminate />
          </div>
        )}
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          firstDay={1}
          hiddenDays={[0, 6]}
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
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          height="auto"
        />
      </div>
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
