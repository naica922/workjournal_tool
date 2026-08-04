"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  declineInvite,
  listMyInvites,
} from "@/server/settings";
import { listApprenticeSummaries } from "@/server/stats";
import { apprenticeshipYear } from "@/lib/apprenticeship";
import { expandOccurrences } from "@/lib/recurrence";
import {
  dayLocationMap,
  expectationFlags,
  lastCompletedMonday,
  weekStats,
} from "@/lib/stats";
import type { DayLocation } from "@/db/schema";
import { ExportView } from "@/components/export/export-view";
import styles from "@/app/settings/settings.module.css";

// Last completed week's stats + flags for one apprentice (computed in local
// time from the recent log blocks the server returned).
function apprenticeWeekStatus(
  blocks: Parameters<typeof expandOccurrences>[0],
  dayLocations: DayLocation[],
) {
  const monday = lastCompletedMonday(new Date());
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  const occ = expandOccurrences(blocks, monday, end);
  const stats = weekStats(occ, monday, dayLocationMap(dayLocations));
  return { monday, stats, flags: expectationFlags(stats) };
}

const weekFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

// Host view: accept or decline invitations and open apprentice calendars.
export function HostDashboard() {
  const queryClient = useQueryClient();
  // Which apprentice's export panel is expanded, if any.
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { data: invites } = useQuery({
    queryKey: ["my-invites"],
    queryFn: () => listMyInvites(),
  });
  const { data: apprentices } = useQuery({
    queryKey: ["my-apprentices"],
    queryFn: () => listApprenticeSummaries(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-invites"] });
    queryClient.invalidateQueries({ queryKey: ["my-apprentices"] });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptInvite,
    onSuccess: invalidate,
  });
  const declineMutation = useMutation({
    mutationFn: declineInvite,
    onSuccess: invalidate,
  });

  return (
    <>
      {(invites?.length ?? 0) > 0 && (
        <section className={styles.card}>
          <h2 className={`${styles.cardTitle} title-medium`}>
            Pending invitations
          </h2>
          <ul className={styles.list}>
            {invites!.map((invite) => (
              <li key={invite.id} className={styles.listItem}>
                <span className={`${styles.listItemText} body-medium`}>
                  {invite.apprenticeName}
                  <br />
                  <span className={`${styles.listItemSub} body-small`}>
                    {invite.apprenticeEmail}
                  </span>
                </span>
                <md-text-button
                  type="button"
                  disabled={declineMutation.isPending}
                  onClick={() => declineMutation.mutate(invite.id)}
                >
                  Decline
                </md-text-button>
                <md-filled-button
                  type="button"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate(invite.id)}
                >
                  Accept
                </md-filled-button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={`${styles.cardTitle} title-medium`}>
          Apprentices with access
        </h2>
        <ul className={styles.list}>
          {(apprentices ?? []).map((apprentice) => {
            const { monday, stats, flags } = apprenticeWeekStatus(
              apprentice.blocks,
              apprentice.dayLocations,
            );
            return (
            <Fragment key={apprentice.assignmentId}>
              <li className={styles.listItem}>
                <span className={`${styles.listItemText} body-medium`}>
                  {apprentice.name}
                  <br />
                  <span className={`${styles.listItemSub} body-small`}>
                    {apprentice.email}
                    {apprentice.apprenticeshipStart &&
                      ` · Year ${apprenticeshipYear(apprentice.apprenticeshipStart)}`}
                    {apprentice.team && ` · ${apprentice.team}`}
                  </span>
                  <span className={styles.weekStatus}>
                    <span className={`${styles.listItemSub} body-small`}>
                      Week of {weekFmt.format(monday)}: {stats.hours.toFixed(0)} h
                      {" · "}
                      {stats.entries}{" "}
                      {stats.entries === 1 ? "entry" : "entries"}
                    </span>
                    {flags.length === 0 ? (
                      <span className={styles.statusOk}>On track</span>
                    ) : (
                      flags.map((flag) => (
                        <span key={flag} className={styles.statusFlag}>
                          {flag}
                        </span>
                      ))
                    )}
                  </span>
                </span>
                <md-text-button
                  type="button"
                  onClick={() =>
                    setExportingId((current) =>
                      current === apprentice.id ? null : apprentice.id,
                    )
                  }
                >
                  <md-icon slot="icon">download</md-icon>
                  Export
                </md-text-button>
                <Link href={`/apprentices/${apprentice.id}`}>
                  <md-text-button type="button">Calendar</md-text-button>
                </Link>
                <Link href={`/apprentices/${apprentice.id}/dashboard`}>
                  <md-filled-tonal-button type="button">
                    <md-icon slot="icon">insights</md-icon>
                    Inspect
                  </md-filled-tonal-button>
                </Link>
              </li>
              {exportingId === apprentice.id && (
                <li className={styles.exportRow}>
                  <ExportView
                    apprenticeId={apprentice.id}
                    apprenticeName={apprentice.name}
                  />
                </li>
              )}
            </Fragment>
          );
          })}
          {apprentices?.length === 0 && (
            <li className={`${styles.empty} body-medium`}>
              No apprentices yet. Ask your apprentices to add your email address in
              their settings.
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
