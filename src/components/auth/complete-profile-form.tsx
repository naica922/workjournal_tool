"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { completeProfile } from "@/server/settings";
import { BIRTHDAY_ERROR, isValidBirthday, todayIso } from "@/lib/profile";
import styles from "@/app/(auth)/auth.module.css";

// Shown once after the first Google sign-in: collects the fields the
// email/password registration asks for.
export function CompleteProfileForm({
  initialFirstName,
  initialLastName,
}: {
  initialFirstName: string;
  initialLastName: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<"apprentice" | "host">("apprentice");
  const [localError, setLocalError] = useState<string | null>(null);
  const birthdayRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (birthdayRef.current) birthdayRef.current.max = todayIso();
  }, []);

  const mutation = useMutation({
    mutationFn: completeProfile,
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const data = new FormData(event.currentTarget);
    const birthday = String(data.get("birthday") ?? "");
    if (!isValidBirthday(birthday)) {
      setLocalError(BIRTHDAY_ERROR);
      return;
    }
    mutation.mutate({
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      birthday,
      role,
      apprenticeshipStart:
        role === "apprentice"
          ? String(data.get("apprenticeshipStart") ?? "") || null
          : null,
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="complete-title">
        <h1 id="complete-title" className={`${styles.title} headline-small`}>
          Complete your profile
        </h1>
        <p className={`${styles.subtitle} body-medium`}>
          A few details before you get started
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.nameRow}>
            <md-outlined-text-field
              class={styles.field}
              label="First name"
              name="firstName"
              required
              value={initialFirstName}
            />
            <md-outlined-text-field
              class={styles.field}
              label="Last name"
              name="lastName"
              required
              value={initialLastName}
            />
          </div>
          <label className={`${styles.dateField} body-small`}>
            Birth date
            <input ref={birthdayRef} type="date" name="birthday" required />
          </label>

          <div className={styles.roleGroup} role="radiogroup" aria-label="Role">
            <span className="body-medium">I am a:</span>
            <label
              className={styles.roleOption}
              onClick={() => setRole("apprentice")}
            >
              <md-radio
                name="role"
                value="apprentice"
                checked={role === "apprentice"}
              />
              <span className="body-medium">Apprentice</span>
            </label>
            <label className={styles.roleOption} onClick={() => setRole("host")}>
              <md-radio name="role" value="host" checked={role === "host"} />
              <span className="body-medium">Host</span>
            </label>
          </div>

          {role === "apprentice" && (
            <label className={`${styles.dateField} body-small`}>
              Apprenticeship start date
              <input type="date" name="apprenticeshipStart" required />
            </label>
          )}

          {(localError || mutation.isError) && (
            <p className={`${styles.error} body-medium`}>
              {localError ?? (mutation.error as Error).message}
            </p>
          )}
          <md-filled-button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Continue"}
          </md-filled-button>
        </form>
      </section>
    </main>
  );
}
