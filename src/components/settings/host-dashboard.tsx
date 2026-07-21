"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvite,
  declineInvite,
  listMyInvites,
  listMyApprentices,
} from "@/server/settings";
import styles from "@/app/settings/settings.module.css";

// Host view: accept or decline invitations and open apprentice calendars.
export function HostDashboard() {
  const queryClient = useQueryClient();

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
        <h2 className={`${styles.cardTitle} title-medium`}>My apprentices</h2>
        <ul className={styles.list}>
          {(apprentices ?? []).map((apprentice) => (
            <li key={apprentice.assignmentId} className={styles.listItem}>
              <span className={`${styles.listItemText} body-medium`}>
                {apprentice.name}
                <br />
                <span className={`${styles.listItemSub} body-small`}>
                  {apprentice.email}
                  {apprentice.apprenticeYear != null &&
                    ` · Year ${apprentice.apprenticeYear}`}
                  {apprentice.team && ` · ${apprentice.team}`}
                </span>
              </span>
              <Link href={`/apprentices/${apprentice.id}`}>
                <md-outlined-button type="button">
                  Open calendar
                </md-outlined-button>
              </Link>
            </li>
          ))}
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
