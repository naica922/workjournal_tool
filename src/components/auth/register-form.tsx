"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import styles from "@/app/(auth)/auth.module.css";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<"apprentice" | "host">("apprentice");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("firstName") ?? "").trim();
    const lastName = String(data.get("lastName") ?? "").trim();

    const email = String(data.get("email") ?? "");
    const { data: result, error } = await signUp.email({
      name: `${firstName} ${lastName}`.trim(),
      email,
      password: String(data.get("password") ?? ""),
      role,
      firstName,
      lastName,
      birthday: String(data.get("birthday") ?? ""),
      apprenticeshipStart:
        role === "apprentice"
          ? String(data.get("apprenticeshipStart") ?? "")
          : undefined,
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Registration failed. Please try again.");
      return;
    }
    // Without a session token the account still needs email verification.
    if (!result?.token) {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="register-title">
        <h1 id="register-title" className={`${styles.title} headline-small`}>
          Create your account
        </h1>
        <p className={`${styles.subtitle} body-medium`}>
          Register for the Arbeitsjournal Tool
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.nameRow}>
            <md-outlined-text-field
              class={styles.field}
              label="First name"
              name="firstName"
              type="text"
              required
            />
            <md-outlined-text-field
              class={styles.field}
              label="Last name"
              name="lastName"
              type="text"
              required
            />
          </div>
          <md-outlined-text-field
            class={styles.field}
            label="Email"
            name="email"
            type="email"
            required
          />
          <md-outlined-text-field
            class={styles.field}
            label="Password"
            name="password"
            type="password"
            required
            supporting-text="At least 8 characters"
          />
          <label className={`${styles.dateField} body-small`}>
            Birth date
            <input type="date" name="birthday" required />
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

          {error && <p className={`${styles.error} body-medium`}>{error}</p>}
          <md-filled-button type="submit" disabled={pending}>
            {pending ? "Creating account..." : "Sign up"}
          </md-filled-button>
        </form>

        <p className={`${styles.switchAuth} body-medium`}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
