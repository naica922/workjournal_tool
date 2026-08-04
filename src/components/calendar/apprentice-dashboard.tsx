"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listAllBlocks, listDayLocations } from "@/server/blocks";
import { expandOccurrences } from "@/lib/recurrence";
import { isoWeek, weekMonday } from "@/lib/week";
import {
  dayLocationMap,
  expectationFlags,
  lastCompletedMonday,
  weekStats,
  type WeekStats,
} from "@/lib/stats";
import styles from "./apprentice-dashboard.module.css";

const rangeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const WEEKS_SHOWN = 8;

type WeekRow = {
  monday: Date;
  friday: Date;
  iso: string;
  stats: WeekStats;
  flags: string[];
};

// Host "Inspect" view for one apprentice: recent weeks with high-level stats
// and quick links into each week's calendar.
export function ApprenticeDashboard({
  apprenticeId,
  apprenticeName,
  apprenticeshipStart,
}: {
  apprenticeId: string;
  apprenticeName: string;
  apprenticeshipStart: string | null;
}) {
  const [now] = useState(() => Date.now());
  const { data: blocks } = useQuery({
    queryKey: ["all-blocks", apprenticeId],
    queryFn: () => listAllBlocks(apprenticeId),
  });
  const { data: dayLocations } = useQuery({
    queryKey: ["day-locations-all", apprenticeId],
    queryFn: () =>
      listDayLocations({
        // A wide range covering the weeks shown.
        start: "2000-01-01",
        end: "2100-01-01",
        apprenticeId,
      }),
  });

  const weeks = useMemo<WeekRow[]>(() => {
    const logBlocks = (blocks ?? []).filter((b) => b.kind === "log");
    const dayLoc = dayLocationMap(dayLocations ?? []);
    const rows: WeekRow[] = [];
    const firstMonday = apprenticeshipStart
      ? weekMonday(new Date(`${apprenticeshipStart}T12:00:00`))
      : null;
    let monday = lastCompletedMonday(new Date(now));
    for (let i = 0; i < WEEKS_SHOWN; i++) {
      if (firstMonday && monday.getTime() < firstMonday.getTime()) break;
      const end = new Date(monday);
      end.setDate(end.getDate() + 7);
      const friday = new Date(monday);
      friday.setDate(friday.getDate() + 4);
      const occ = expandOccurrences(logBlocks, monday, end);
      const stats = weekStats(occ, monday, dayLoc);
      rows.push({
        monday: new Date(monday),
        friday,
        iso: monday.toISOString(),
        stats,
        flags: expectationFlags(stats),
      });
      monday = new Date(monday);
      monday.setDate(monday.getDate() - 7);
    }
    return rows;
  }, [blocks, dayLocations, now, apprenticeshipStart]);

  const isoDay = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const latest = weeks[0];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={`${styles.heading} headline-small`}>
          {apprenticeName}
        </h1>
        <Link href={`/apprentices/${apprenticeId}`}>
          <md-outlined-button type="button">
            <md-icon slot="icon">calendar_month</md-icon>
            Open calendar
          </md-outlined-button>
        </Link>
      </div>

      {latest && (
        <div className={styles.tiles}>
          <Tile label="Hours (last week)" value={`${latest.stats.hours.toFixed(0)} h`} />
          <Tile label="Office" value={`${latest.stats.officeHours.toFixed(0)} h`} />
          <Tile label="Home" value={`${latest.stats.homeHours.toFixed(0)} h`} />
          <Tile
            label="Status"
            value={latest.flags.length === 0 ? "On track" : "Needs attention"}
            tone={latest.flags.length === 0 ? "ok" : "flag"}
          />
        </div>
      )}

      <section className={styles.card}>
        <h2 className={`${styles.cardTitle} title-medium`}>Recent weeks</h2>
        <ul className={styles.weeks}>
          {weeks.map((w) => (
            <li key={w.iso}>
              <Link
                href={`/apprentices/${apprenticeId}?date=${isoDay(w.monday)}`}
                className={styles.week}
              >
                <span className={styles.weekName}>
                  <span className="body-medium">KW {isoWeek(w.monday)}</span>
                  <span className={`${styles.weekDates} body-small`}>
                    {rangeFmt.format(w.monday)} – {rangeFmt.format(w.friday)}
                  </span>
                </span>
                <span className={styles.weekStats}>
                  <span className="body-small">
                    {w.stats.hours.toFixed(0)} h · {w.stats.entries}{" "}
                    {w.stats.entries === 1 ? "entry" : "entries"}
                  </span>
                  {w.flags.length === 0 ? (
                    <span className={styles.ok}>On track</span>
                  ) : (
                    w.flags.map((f) => (
                      <span key={f} className={styles.flag}>
                        {f}
                      </span>
                    ))
                  )}
                </span>
              </Link>
            </li>
          ))}
          {weeks.length === 0 && (
            <li className={`${styles.empty} body-medium`}>
              No completed weeks yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "flag";
}) {
  return (
    <div className={styles.tile}>
      <span className={`${styles.tileLabel} body-small`}>{label}</span>
      <span
        className={
          tone === "flag"
            ? styles.tileValueFlag
            : tone === "ok"
              ? styles.tileValueOk
              : styles.tileValue
        }
      >
        {value}
      </span>
    </div>
  );
}
