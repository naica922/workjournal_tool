"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfile, type getProfile } from "@/server/settings";
import { apprenticeshipYear } from "@/lib/apprenticeship";
import styles from "@/app/settings/settings.module.css";

type Profile = Awaited<ReturnType<typeof getProfile>>;

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatDate(value: string | null): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const data = new FormData(event.currentTarget);
    // Only the team is editable; identity fields are fixed after sign-up.
    mutation.mutate({ team: String(data.get("team") ?? "") || null });
  }

  const isApprentice = profile.role === "apprentice";

  return (
    <section className={styles.card}>
      <h2 className={`${styles.cardTitle} title-medium`}>Profile</h2>

      {/* Identity fields are set at sign-up and cannot be changed here. */}
      <dl className={styles.identityGrid}>
        <div className={styles.identityItem}>
          <dt className={`${styles.identityLabel} body-small`}>First name</dt>
          <dd className={`${styles.identityValue} body-medium`}>
            {profile.firstName ?? "—"}
          </dd>
        </div>
        <div className={styles.identityItem}>
          <dt className={`${styles.identityLabel} body-small`}>Last name</dt>
          <dd className={`${styles.identityValue} body-medium`}>
            {profile.lastName ?? "—"}
          </dd>
        </div>
        <div className={styles.identityItem}>
          <dt className={`${styles.identityLabel} body-small`}>Email</dt>
          <dd className={`${styles.identityValue} body-medium`}>
            {profile.email}
          </dd>
        </div>
        <div className={styles.identityItem}>
          <dt className={`${styles.identityLabel} body-small`}>Birth date</dt>
          <dd className={`${styles.identityValue} body-medium`}>
            {formatDate(profile.birthday)}
          </dd>
        </div>
        {isApprentice && (
          <div className={styles.identityItem}>
            <dt className={`${styles.identityLabel} body-small`}>
              Apprenticeship start
            </dt>
            <dd className={`${styles.identityValue} body-medium`}>
              {formatDate(profile.apprenticeshipStart)}
              {profile.apprenticeshipStart &&
                ` · Year ${apprenticeshipYear(profile.apprenticeshipStart)}`}
            </dd>
          </div>
        )}
      </dl>

      {isApprentice && (
        <form className={styles.form} onSubmit={handleSubmit}>
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
      )}
    </section>
  );
}
