"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  declineInvite,
  listMyInvites,
  listMyApprentices,
  promoteApprenticeToHost,
} from "@/server/settings";
import { apprenticeshipYear } from "@/lib/apprenticeship";
import styles from "@/app/settings/settings.module.css";

// Host view: accept or decline invitations and open apprentice calendars.
export function HostDashboard() {
  const queryClient = useQueryClient();
  // Promoting an apprentice to host is rare; it asks for confirmation inline.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: invites } = useQuery({
    queryKey: ["my-invites"],
    queryFn: () => listMyInvites(),
  });
  const { data: apprentices } = useQuery({
    queryKey: ["my-apprentices"],
    queryFn: () => listMyApprentices(),
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
  const promoteMutation = useMutation({
    mutationFn: promoteApprenticeToHost,
    onSuccess: () => {
      setConfirmingId(null);
      invalidate();
    },
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
          {(apprentices ?? []).map((apprentice) =>
            confirmingId === apprentice.id ? (
              <li key={apprentice.assignmentId} className={styles.listItem}>
                <span className={`${styles.listItemText} body-medium`}>
                  Make {apprentice.name} a host?
                  <br />
                  <span className={`${styles.listItemSub} body-small`}>
                    They will be able to supervise apprentices themselves.
                  </span>
                </span>
                <md-text-button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                >
                  Cancel
                </md-text-button>
                <md-filled-button
                  type="button"
                  disabled={promoteMutation.isPending}
                  onClick={() => promoteMutation.mutate(apprentice.id)}
                >
                  Make host
                </md-filled-button>
              </li>
            ) : (
              <li key={apprentice.assignmentId} className={styles.listItem}>
                <span className={`${styles.listItemText} body-medium`}>
                  {apprentice.name}
                  <br />
                  <span className={`${styles.listItemSub} body-small`}>
                    {apprentice.email}
                    {apprentice.apprenticeshipStart &&
                      ` · Year ${apprenticeshipYear(apprentice.apprenticeshipStart)}`}
                    {apprentice.team && ` · ${apprentice.team}`}
                  </span>
                </span>
                <md-icon-button
                  type="button"
                  title="Make host"
                  onClick={() => setConfirmingId(apprentice.id)}
                >
                  <md-icon>shield_person</md-icon>
                </md-icon-button>
                <Link href={`/apprentices/${apprentice.id}/projects`}>
                  <md-text-button type="button">Projects</md-text-button>
                </Link>
                <Link href={`/apprentices/${apprentice.id}`}>
                  <md-outlined-button type="button">
                    Open calendar
                  </md-outlined-button>
                </Link>
              </li>
            ),
          )}
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
