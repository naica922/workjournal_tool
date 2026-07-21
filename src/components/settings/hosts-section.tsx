"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHostInvite, listMyHosts, removeHost } from "@/server/settings";
import styles from "@/app/settings/settings.module.css";

// Apprentice view: add hosts by email and see whether they accepted.
export function HostsSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: hosts } = useQuery({
    queryKey: ["my-hosts"],
    queryFn: () => listMyHosts(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["my-hosts"] });

  const addMutation = useMutation({
    mutationFn: addHostInvite,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeHost,
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    addMutation.mutate({ email: String(data.get("hostEmail") ?? "") });
    form.reset();
  }

  return (
    <section className={styles.card}>
      <h2 className={`${styles.cardTitle} title-medium`}>My hosts</h2>
      <p className={`${styles.empty} body-medium`}>
        A host you add can see your calendar once they accept the invitation.
      </p>
      <form className={styles.inviteRow} onSubmit={handleSubmit}>
        <md-outlined-text-field
          label="Host email"
          name="hostEmail"
          type="email"
          required
        />
        <md-filled-tonal-button type="submit" disabled={addMutation.isPending}>
          Add host
        </md-filled-tonal-button>
      </form>
      {error && <p className={`${styles.error} body-medium`}>{error}</p>}
      <ul className={styles.list}>
        {(hosts ?? []).map((host) => (
          <li key={host.id} className={styles.listItem}>
            <span className={`${styles.listItemText} body-medium`}>
              {host.hostEmail}
            </span>
            <span
              className={
                host.status === "accepted"
                  ? styles.chipAccepted
                  : styles.chipPending
              }
            >
              {host.status === "accepted" ? "Accepted" : "Pending"}
            </span>
            <md-icon-button
              type="button"
              aria-label={`Remove ${host.hostEmail}`}
              onClick={() => removeMutation.mutate(host.id)}
            >
              <md-icon>delete</md-icon>
            </md-icon-button>
          </li>
        ))}
        {hosts?.length === 0 && (
          <li className={`${styles.empty} body-medium`}>No hosts added yet.</li>
        )}
      </ul>
    </section>
  );
}
