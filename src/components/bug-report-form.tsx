"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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

export function BugReportForm({
  identity,
}: {
  identity?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}) {
  const [formFactor, setFormFactor] = useState<"mobile" | "laptop">("laptop");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    const files = event.dataTransfer.files;
    if (files.length && fileRef.current) {
      fileRef.current.files = files;
      setFileName(files[0].name);
    }
  }

  const mutation = useMutation({
    mutationFn: submitBugReport,
    onSuccess: (result) => {
      if (!result.ok) setError(result.error);
    },
    onError: () =>
      setError("Something went wrong submitting the report. Please retry."),
  });
  const submitted = mutation.isSuccess && mutation.data?.ok === true;

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
      // Signed-in users report under their profile identity.
      firstName: identity?.firstName || String(data.get("firstName") ?? ""),
      lastName: identity?.lastName || String(data.get("lastName") ?? ""),
      email: identity?.email || String(data.get("email") ?? ""),
      description: String(data.get("description") ?? ""),
      deviceType: String(data.get("deviceType") ?? "") || undefined,
      formFactor,
      page: String(data.get("page") ?? "") || undefined,
      links: String(data.get("links") ?? "") || undefined,
      screenshot,
    });
  }

  if (submitted) {
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
        <div className={styles.iconCircle} aria-hidden="true">
          <md-icon>bug_report</md-icon>
        </div>
        <h1 id="bug-title" className={`${styles.title} headline-small`}>
          Report a bug
        </h1>
        <p className={`${styles.subtitle} body-medium`}>
          Tell us what went wrong so we can fix it.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {identity ? (
            <p className={`${styles.subtitle} body-medium`}>
              Reporting as {identity.firstName} {identity.lastName} (
              {identity.email})
            </p>
          ) : (
            <>
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
            </>
          )}
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

          <div>
            <p className={`${styles.fieldLabel} body-small`}>
              Screenshot (optional)
            </p>
            <label
              className={
                dragActive ? styles.dropzoneActive : styles.dropzone
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <md-icon class={styles.dropzoneIcon}>upload</md-icon>
              <span className="body-medium">
                {fileName ? (
                  fileName
                ) : (
                  <>
                    <span className={styles.dropzoneLink}>Choose a file</span> or
                    drag it here
                  </>
                )}
              </span>
              <input
                ref={fileRef}
                type="file"
                name="screenshot"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) =>
                  setFileName(e.target.files?.[0]?.name ?? null)
                }
              />
            </label>
          </div>

          <md-outlined-text-field
            class={styles.field}
            label="Links (optional)"
            name="links"
            type="textarea"
            rows={2}
            supporting-text="e.g. a screen recording or a related document, one per line"
          />

          {error && <p className={`${styles.error} body-medium`}>{error}</p>}
          <md-filled-button
            type="submit"
            disabled={mutation.isPending}
            style={{ width: "100%" }}
          >
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
