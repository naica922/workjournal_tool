"use client";

import { useState } from "react";
import styles from "./export-view.module.css";

type PeriodKey = "week" | "6m" | "12m" | "custom";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "week", label: "Last week" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Custom" },
];

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The from/to range for a preset, ending today.
function presetRange(key: PeriodKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (key === "week") from.setDate(from.getDate() - 7);
  else if (key === "6m") from.setMonth(from.getMonth() - 6);
  else from.setMonth(from.getMonth() - 12);
  return { from: isoDate(from), to: isoDate(to) };
}

export function ExportView() {
  const [period, setPeriod] = useState<PeriodKey>("6m");
  const today = isoDate(new Date());
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return isoDate(d);
  });
  const [customTo, setCustomTo] = useState(today);

  const range =
    period === "custom"
      ? { from: customFrom, to: customTo }
      : presetRange(period);
  const customInvalid = period === "custom" && customFrom > customTo;
  const href = `/api/export?from=${range.from}&to=${range.to}`;

  return (
    <div className={styles.page}>
      <h1 className={`${styles.heading} headline-small`}>Export</h1>

      <section className={styles.card}>
        <md-icon class={styles.cardIcon}>picture_as_pdf</md-icon>
        <h2 className={`${styles.cardTitle} title-medium`}>
          Export your journal
        </h2>
        <p className={`${styles.cardText} body-medium`}>
          Download a PDF summary of your work for a chosen period. It is ideal
          to share your progress with your host or to keep for your records.
        </p>

        <ul className={styles.included}>
          <li className={`${styles.includedItem} body-small`}>
            <md-icon>check</md-icon> A written summary of what you worked on
          </li>
          <li className={`${styles.includedItem} body-small`}>
            <md-icon>check</md-icon> Time invested per project
          </li>
          <li className={`${styles.includedItem} body-small`}>
            <md-icon>check</md-icon> Blockers, solutions and links
          </li>
        </ul>

        <p className={`${styles.periodLabel} body-medium`}>Period</p>
        <div className={styles.periodRow} role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={period === p.key}
              className={
                period === p.key
                  ? styles.periodButtonSelected
                  : styles.periodButton
              }
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className={styles.customRow}>
            <label className={`${styles.dateField} body-small`}>
              Start date
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className={`${styles.dateField} body-small`}>
              End date
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={today}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
          </div>
        )}

        {customInvalid && (
          <p className={`${styles.error} body-small`}>
            The start date must be before the end date.
          </p>
        )}

        <div className={styles.downloadRow}>
          <a
            href={customInvalid ? undefined : href}
            download
            aria-disabled={customInvalid}
            className={
              customInvalid
                ? `${styles.downloadButton} ${styles.downloadButtonDisabled}`
                : styles.downloadButton
            }
          >
            <md-icon>download</md-icon>
            Download PDF
          </a>
        </div>
      </section>
    </div>
  );
}
