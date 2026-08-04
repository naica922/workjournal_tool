"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  switchOwnRole,
  updateProfile,
  type getProfile,
} from "@/server/settings";
import { apprenticeshipYear } from "@/lib/apprenticeship";
import { todayIso } from "@/lib/profile";
import styles from "@/app/settings/settings.module.css";

type Profile = Awaited<ReturnType<typeof getProfile>>;

export function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);
  const birthdayRef = useRef<HTMLInputElement | null>(null);

  const isApprentice = profile.role === "apprentice";
  const target = isApprentice ? "host" : "apprentice";

  useEffect(() => {
    if (birthdayRef.current) birthdayRef.current.max = todayIso();
  }, []);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      router.refresh();
    },
  });

  const switchMutation = useMutation({
    mutationFn: () => switchOwnRole(target),
    onSuccess: () => {
      setConfirmingSwitch(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.push("/");
      router.refresh();
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const data = new FormData(event.currentTarget);
    mutation.mutate({
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      birthday: String(data.get("birthday") ?? "") || null,
      apprenticeshipStart: String(data.get("apprenticeshipStart") ?? "") || null,
      team: String(data.get("team") ?? "") || null,
    });
  }

  return (
    <>
      <section className={styles.card}>
        <h2 className={`${styles.cardTitle} title-medium`}>Profile</h2>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.nameRow}>
            <md-outlined-text-field
              class={styles.field}
              label="First name"
              name="firstName"
              required
              value={profile.firstName ?? ""}
            />
            <md-outlined-text-field
              class={styles.field}
              label="Last name"
              name="lastName"
              required
              value={profile.lastName ?? ""}
            />
          </div>

          {/* Email changes affect sign-in, so they are not self-service. */}
          <div className={styles.identityItem}>
            <dt className={`${styles.identityLabel} body-small`}>Email</dt>
            <dd className={`${styles.identityValue} body-medium`}>
              {profile.email}
            </dd>
          </div>

          {isApprentice && (
            <>
              <label className={`${styles.dateField} body-small`}>
                Birth date (optional)
                <input
                  ref={birthdayRef}
                  type="date"
                  name="birthday"
                  defaultValue={profile.birthday ?? ""}
                />
              </label>
              <label className={`${styles.dateField} body-small`}>
                Apprenticeship start
                {profile.apprenticeshipStart &&
                  ` · Year ${apprenticeshipYear(profile.apprenticeshipStart)}`}
                <input
                  type="date"
                  name="apprenticeshipStart"
                  defaultValue={profile.apprenticeshipStart ?? ""}
                />
              </label>
            </>
          )}

          <md-outlined-text-field
            label="Team"
            name="team"
            value={profile.team ?? ""}
          />

          {mutation.isError && (
            <p className={`${styles.error} body-medium`}>
              {(mutation.error as Error).message}
            </p>
          )}
          {saved && (
            <p className={`${styles.success} body-medium`}>Profile saved.</p>
          )}
          <div className={styles.actions}>
            <md-filled-button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </md-filled-button>
          </div>
        </form>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <h2 className={`${styles.cardTitle} title-medium`}>Account role</h2>
        <p className={`${styles.cardText} body-medium`}>
          You are currently {isApprentice ? "an apprentice" : "a host"}.
          {" "}
          Switching to {target === "host" ? "a host" : "an apprentice"} account
          changes what the whole app shows you. Only do this for a real
          transition — misusing it (e.g. to avoid supervision) can have
          consequences. Your existing journal history is kept either way.
        </p>
        {confirmingSwitch ? (
          <div className={styles.actions}>
            <md-text-button
              type="button"
              onClick={() => setConfirmingSwitch(false)}
            >
              Cancel
            </md-text-button>
            <md-filled-button
              type="button"
              class={styles.dangerButton}
              disabled={switchMutation.isPending}
              onClick={() => switchMutation.mutate()}
            >
              {switchMutation.isPending
                ? "Switching..."
                : `Yes, switch me to ${target}`}
            </md-filled-button>
          </div>
        ) : (
          <div className={styles.actions}>
            <md-outlined-button
              type="button"
              class={styles.dangerButton}
              onClick={() => setConfirmingSwitch(true)}
            >
              Switch to {target} account
            </md-outlined-button>
          </div>
        )}
      </section>
    </>
  );
}
