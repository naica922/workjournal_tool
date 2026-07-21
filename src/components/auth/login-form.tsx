"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import styles from "@/app/(auth)/auth.module.css";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const { error } = await signIn.email({
      email,
      password: String(data.get("password") ?? ""),
    });

    setPending(false);
    if (error) {
      // 403: the account exists but the email address is not verified yet.
      if (error.status === 403) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(error.message ?? "Sign in failed. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={`${styles.title} headline-small`}>
          Arbeitsjournal Tool
        </h1>
        <p className={`${styles.subtitle} body-medium`}>
          Sign in to your account
        </p>

        {googleEnabled && (
          <>
            <md-outlined-button type="button" onClick={handleGoogle}>
              Sign in with Google
            </md-outlined-button>
            <div className={`${styles.divider} body-small`}>or</div>
          </>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
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
          />
          {error && <p className={`${styles.error} body-medium`}>{error}</p>}
          <md-filled-button type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </md-filled-button>
        </form>

        <p className={`${styles.switchAuth} body-medium`}>
          Don&apos;t have an account? <Link href="/register">Sign up</Link>
        </p>
      </section>
    </main>
  );
}
