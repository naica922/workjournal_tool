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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const { error } = await signUp.email({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      role: String(data.get("role") ?? "apprentice"),
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Registration failed. Please try again.");
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
          <md-outlined-text-field
            class={styles.field}
            label="Name"
            name="name"
            type="text"
            required
          />
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

          <div className={styles.roleGroup} role="radiogroup" aria-label="Role">
            <span className="body-medium">I am a:</span>
            <label className={styles.roleOption}>
              <md-radio name="role" value="apprentice" checked />
              <span className="body-medium">Apprentice</span>
            </label>
            <label className={styles.roleOption}>
              <md-radio name="role" value="host" />
              <span className="body-medium">Host</span>
            </label>
          </div>

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
