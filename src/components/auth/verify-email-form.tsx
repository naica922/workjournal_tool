"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "@/app/(auth)/auth.module.css";

export function VerifyEmailForm({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const { error } = await authClient.emailOtp.verifyEmail({
      email,
      otp: String(data.get("otp") ?? "").trim(),
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Invalid code. Please try again.");
      return;
    }
    setVerified(true);
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (error) {
      setError(error.message ?? "Could not send a new code.");
      return;
    }
    setNotice("A new code has been sent.");
  }

  if (verified) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={`${styles.title} headline-small`}>Email verified</h1>
          <p className={`${styles.subtitle} body-medium`}>
            Your account is ready to use.
          </p>
          <Link href="/login">
            <md-filled-button type="button" style={{ width: "100%" }}>
              Continue to sign in
            </md-filled-button>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="verify-title">
        <h1 id="verify-title" className={`${styles.title} headline-small`}>
          Verify your email
        </h1>
        <p className={`${styles.subtitle} body-medium`}>
          We sent a 6-digit code to {email}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <md-outlined-text-field
            class={styles.field}
            label="Verification code"
            name="otp"
            required
            inputmode="numeric"
            maxlength="6"
          />
          {error && <p className={`${styles.error} body-medium`}>{error}</p>}
          {notice && <p className={`${styles.success} body-medium`}>{notice}</p>}
          <md-filled-button type="submit" disabled={pending}>
            {pending ? "Verifying..." : "Verify"}
          </md-filled-button>
          <md-text-button type="button" onClick={handleResend}>
            Resend code
          </md-text-button>
        </form>
      </section>
    </main>
  );
}
