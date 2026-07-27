"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { submitBugReport } from "@/server/bug-report";
import styles from "@/app/(auth)/auth.module.css";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function BugReportForm() {
  const [formFactor, setFormFactor] = useState<"mobile" | "laptop">("laptop");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitBugReport,
    onError: (e: Error) => setError(e.message),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);

    let screenshot: string | undefined;
    const file = data.get("screenshot");
    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) {
        setError("The screenshot is too large (max 2 MB).");
        return;
      }
      screenshot = await readFileAsDataUrl(file);
    }

    mutation.mutate({
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      email: String(data.get("email") ?? ""),
      description: String(data.get("description") ?? ""),
      deviceType: String(data.get("deviceType") ?? "") || undefined,
      formFactor,
      page: String(data.get("page") ?? "") || undefined,
      screenshot,
    });
  }

  if (mutation.isSuccess) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={`${styles.title} headline-small`}>Thank you!</h1>
          <p className={`${styles.subtitle} body-medium`}>
            Your report has been submitted. We will look into it.
          </p>
          <Link href="/">
            <md-filled-button type="button" style={{ width: "100%" }}>
              Back to the app
            </md-filled-button>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section
        className={styles.card}
        style={{ maxWidth: "34rem" }}
        aria-labelledby="bug-title"
      >
        <h1 id="bug-title" className={`${styles.title} headline-small`}>
          Report a bug
        </h1>
        <p className={`${styles.subtitle} body-medium`}>
          Tell us what went wrong so we can fix it.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.nameRow}>
            <md-outlined-text-field
              class={styles.field}
              label="First name"
              name="firstName"
              required
            />
            <md-outlined-text-field
              class={styles.field}
              label="Last name"
              name="lastName"
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
            label="What happened?"
            name="description"
            type="textarea"
            rows={4}
            required
            supporting-text="What did you do, and what went wrong?"
          />
          <md-outlined-text-field
            class={styles.field}
            label="Device"
            name="deviceType"
            supporting-text="e.g. iPhone 15, Windows laptop, MacBook"
          />

          <div className={styles.roleGroup} role="radiogroup" aria-label="Device type">
            <span className="body-medium">I use a:</span>
            <label
              className={styles.roleOption}
              onClick={() => setFormFactor("laptop")}
            >
              <md-radio
                name="formFactor"
                value="laptop"
                checked={formFactor === "laptop"}
              />
              <span className="body-medium">Laptop</span>
            </label>
            <label
              className={styles.roleOption}
              onClick={() => setFormFactor("mobile")}
            >
              <md-radio
                name="formFactor"
                value="mobile"
                checked={formFactor === "mobile"}
              />
              <span className="body-medium">Mobile</span>
            </label>
          </div>

          <md-outlined-text-field
            class={styles.field}
            label="Which page?"
            name="page"
            supporting-text="e.g. Calendar, Projects, Settings"
          />

          <label className="body-medium">
            Screenshot (optional)
            <input
              type="file"
              name="screenshot"
              accept="image/*"
              style={{ display: "block", marginTop: "0.5rem" }}
            />
          </label>

          {error && <p className={`${styles.error} body-medium`}>{error}</p>}
          <md-filled-button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting..." : "Submit report"}
          </md-filled-button>
        </form>

        <p className={`${styles.switchAuth} body-medium`}>
          <Link href="/">Back to the app</Link>
        </p>
      </section>
    </main>
  );
}
