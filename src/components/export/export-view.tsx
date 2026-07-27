"use client";

import { useState } from "react";
import styles from "./export-view.module.css";

const PERIODS = [
  { months: 1, label: "Last month" },
  { months: 3, label: "Last 3 months" },
  { months: 6, label: "Last 6 months" },
  { months: 12, label: "Last 12 months" },
];

export function ExportView() {
  const [months, setMonths] = useState(6);
  const href = `/api/export?months=${months}`;

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
              key={p.months}
              type="button"
              role="radio"
              aria-checked={months === p.months}
              className={
                months === p.months
                  ? styles.periodButtonSelected
                  : styles.periodButton
              }
              onClick={() => setMonths(p.months)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className={styles.downloadRow}>
          <a href={href} download className={styles.downloadButton}>
            <md-icon>download</md-icon>
            Download PDF
          </a>
        </div>
      </section>
    </div>
  );
}
