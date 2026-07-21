"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfile, type getProfile } from "@/server/settings";
import styles from "@/app/settings/settings.module.css";

type Profile = Awaited<ReturnType<typeof getProfile>>;

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
    mutation.mutate({
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      birthday: String(data.get("birthday") ?? ""),
      apprenticeshipStart:
        String(data.get("apprenticeshipStart") ?? "") || null,
      team: String(data.get("team") ?? "") || null,
    });
  }

  const isApprentice = profile.role === "apprentice";

  return (
    <section className={styles.card}>
      <h2 className={`${styles.cardTitle} title-medium`}>Profile</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <md-outlined-text-field
            label="First name"
            name="firstName"
            required
            value={profile.firstName ?? ""}
          />
          <md-outlined-text-field
            label="Last name"
            name="lastName"
            required
            value={profile.lastName ?? ""}
          />
        </div>
        <md-outlined-text-field label="Email" disabled value={profile.email} />
        <label className={`${styles.dateField} body-small`}>
          Birth date
          <input
            type="date"
            name="birthday"
            required
            defaultValue={profile.birthday ?? ""}
          />
        </label>
        {isApprentice && (
          <>
            <label className={`${styles.dateField} body-small`}>
              Apprenticeship start date
              <input
                type="date"
                name="apprenticeshipStart"
                defaultValue={profile.apprenticeshipStart ?? ""}
              />
            </label>
            <md-outlined-text-field
              label="Team"
              name="team"
              value={profile.team ?? ""}
            />
          </>
        )}
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
  );
}
