"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./mini-month.module.css";

export const GOTO_DATE_EVENT = "workjournal:goto-date";

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

// Monday-first single letters like the mock.
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Sidebar month picker from the mock; clicking a day jumps the main
// calendar there (loose coupling via a window event so the server-rendered
// shell can slot it next to the client calendar).
export function MiniMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // On the calendar itself, jump the mounted calendar instantly; from any
  // other tab, navigate to the calendar on the picked day.
  function goToDay(day: Date) {
    if (pathname === "/") {
      window.dispatchEvent(
        new CustomEvent(GOTO_DATE_EVENT, { detail: day.getTime() }),
      );
    } else {
      router.push(`/?date=${isoDay(day)}`);
    }
  }

  const today = new Date();
  // Monday-first offset of the 1st (getDay: 0=Sun..6=Sat).
  const lead = (month.getDay() + 6) % 7;
  const gridStart = new Date(month);
  gridStart.setDate(1 - lead);
  const weeks = Math.ceil((lead + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const shift = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div className={styles.mini} aria-label="Month overview">
      <div className={styles.head}>
        <span className={styles.title}>{MONTH_FORMAT.format(month)}</span>
        <span className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous month"
            onClick={() => shift(-1)}
          >
            <md-icon>chevron_left</md-icon>
          </button>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next month"
            onClick={() => shift(1)}
          >
            <md-icon>chevron_right</md-icon>
          </button>
        </span>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <span key={`w${i}`} className={styles.weekday}>
            {w}
          </span>
        ))}
        {days.map((day) => {
          const isToday = sameDay(day, today);
          const outside = day.getMonth() !== month.getMonth();
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={
                isToday
                  ? styles.dayToday
                  : outside
                    ? styles.dayOutside
                    : styles.day
              }
              onClick={() => goToDay(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
