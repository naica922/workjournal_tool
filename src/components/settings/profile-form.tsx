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
      name: String(data.get("name") ?? ""),
      apprenticeYear: String(data.get("apprenticeYear") ?? "") || null,
      team: String(data.get("team") ?? "") || null,
      birthday: String(data.get("birthday") ?? "") || null,
    });
  }

  const isLearner = profile.role === "learner";

  return (
    <section className={styles.card}>
      <h2 className={`${styles.cardTitle} title-medium`}>Profile</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <md-outlined-text-field
          label="Name"
          name="name"
          required
          value={profile.name}
        />
        <md-outlined-text-field label="Email" disabled value={profile.email} />
        {isLearner && (
          <>
            <div className={styles.row}>
              <md-outlined-text-field
                label="Apprenticeship year"
                name="apprenticeYear"
                type="number"
                min="1"
                max="6"
                value={profile.apprenticeYear?.toString() ?? ""}
              />
              <md-outlined-text-field
                label="Team"
                name="team"
                value={profile.team ?? ""}
              />
            </div>
            <label className={`${styles.dateField} body-small`}>
              Birthday
              <input
                type="date"
                name="birthday"
                defaultValue={profile.birthday ?? ""}
              />
            </label>
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
