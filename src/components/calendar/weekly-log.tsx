"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAllBlocks } from "@/server/blocks";
import { expandOccurrences } from "@/lib/recurrence";
import { fridayCutoff, isLateEntry, weekMonday } from "@/lib/week";
import { GOTO_DATE_EVENT } from "./mini-month";
import styles from "./weekly-log.module.css";

const rangeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

// ISO week number (weeks start Monday; week 1 holds the first Thursday).
function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

type WeekRow = {
  key: string;
  monday: Date;
  friday: Date;
  entries: number;
  late: number;
  sealed: boolean;
};

// Weekly log shown to the host: what the apprentice had entered by each
// Friday 18:00 deadline, and how many entries arrived late.
export function WeeklyLog({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = useState(false);
  // Absolute "now" instant for sealing/late checks (stable per mount).
  const [now] = useState(() => Date.now());
  const { data: blocks } = useQuery({
    queryKey: ["all-blocks", ownerId],
    queryFn: () => listAllBlocks(ownerId),
  });

  const weeks = useMemo<WeekRow[]>(() => {
    if (!blocks || blocks.length === 0) return [];
    const starts = blocks.map((b) => new Date(b.start).getTime());
    const earliest = new Date(Math.min(...starts));
    const rangeStart = weekMonday(earliest);
    const rangeEnd = new Date(now);
    const occurrences = expandOccurrences(blocks, rangeStart, rangeEnd);

    const map = new Map<string, WeekRow>();
    for (const occ of occurrences) {
      const monday = weekMonday(occ.start);
      const key = monday.toISOString();
      let row = map.get(key);
      if (!row) {
        const friday = fridayCutoff(monday);
        row = {
          key,
          monday,
          friday,
          entries: 0,
          late: 0,
          sealed: friday.getTime() < now,
        };
        map.set(key, row);
      }
      row.entries += 1;
      if (isLateEntry(occ.updatedAt, occ.start)) row.late += 1;
    }
    return [...map.values()].sort(
      (a, b) => b.monday.getTime() - a.monday.getTime(),
    );
  }, [blocks, now]);

  function jumpTo(monday: Date) {
    window.dispatchEvent(
      new CustomEvent(GOTO_DATE_EVENT, { detail: monday.getTime() }),
    );
  }

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <md-icon>{open ? "expand_more" : "chevron_right"}</md-icon>
        <span className="title-medium">Weekly log</span>
        <span className={`${styles.hint} body-small`}>
          sealed every Friday 18:00
        </span>
      </button>

      {open && (
        <ul className={styles.list}>
          {weeks.map((w) => (
            <li key={w.key}>
              <button
                type="button"
                className={styles.week}
                onClick={() => jumpTo(w.monday)}
                title="Show this week in the calendar"
              >
                <span className={styles.weekName}>
                  <span className="body-medium">KW {isoWeek(w.monday)}</span>
                  <span className={`${styles.weekDates} body-small`}>
                    {rangeFmt.format(w.monday)} – {rangeFmt.format(w.friday)}
                  </span>
                </span>
                <span className={styles.counts}>
                  <span className="body-small">
                    {w.entries} {w.entries === 1 ? "entry" : "entries"}
                  </span>
                  {w.late > 0 && (
                    <span className={`${styles.late} body-small`}>
                      <md-icon class={styles.lateIcon}>history</md-icon>
                      {w.late} late
                    </span>
                  )}
                  {!w.sealed && (
                    <span className={`${styles.inProgress} body-small`}>
                      in progress
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {weeks.length === 0 && (
            <li className={`${styles.empty} body-medium`}>No entries yet.</li>
          )}
        </ul>
      )}
    </section>
  );
}
