"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date | null; muted: boolean }[] = [];
  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, -startPad + i + 1);
    cells.push({ date: d, muted: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), muted: false });
  }
  while (cells.length % 7 !== 0) {
    const next = cells.length - startPad - daysInMonth + 1;
    cells.push({
      date: new Date(year, month + 1, next),
      muted: true,
    });
  }
  return cells;
}

export function CalendarClient() {
  const { user } = useOfficeAuth();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
  });
  const yearLabel = viewMonth.getFullYear();

  const grid = useMemo(
    () => buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth]
  );

  const shiftMonth = (delta: number) => {
    setViewMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() + delta, 1)
    );
  };

  return (
    <OfficeShell
      activeNav="calendar"
      user={user}
      crumbs={
        <>
          <span>ProScope Office</span>
          <span className={styles.crumbsHere}>/ Calendar</span>
        </>
      }
      topbarEnd={
        <button type="button" className={styles.btnPrimary}>
          + New event
        </button>
      }
    >
      <div className={styles.content}>
        <div className={styles.calHeader}>
          <h1 className={styles.calTitle}>
            {monthLabel}{" "}
            <span className={styles.calTitleMuted}>{yearLabel}</span>
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() =>
                setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
              }
            >
              Today
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
            <span className={styles.chip} style={{ marginLeft: 8 }}>
              Month
            </span>
          </div>
        </div>

        <div className={styles.calLayout}>
          <aside className={styles.calRail}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>{monthLabel}</div>
              <div className={styles.miniCalGrid}>
                {grid.slice(0, 35).map(({ date, muted }, i) => {
                  if (!date) return <div key={i} />;
                  const isToday =
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
                  return (
                    <div
                      key={i}
                      className={`${styles.miniDay} ${isToday ? styles.miniDayToday : ""}`}
                      style={muted ? { opacity: 0.45 } : undefined}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className={styles.card}>
              <div className={styles.cardHeader}>Event types</div>
              {[
                ["Inspection", "var(--accent)"],
                ["BEI / Repairability", "var(--bei)"],
                ["Adjuster", "var(--info)"],
                ["Admin", "var(--ink-mute)"],
              ].map(([label, color]) => (
                <div key={label} className={styles.filterRow}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={styles.swatch} style={{ background: color }} />
                    {label}
                  </span>
                  <span className={styles.monoMute}>—</span>
                </div>
              ))}
            </section>
            <section className={styles.card}>
              <div className={styles.cardHeader}>Inspectors</div>
              <div className={styles.filterRow}>
                <span>{user?.email?.split("@")[0] ?? "You"}</span>
                <span className={styles.monoMute}>—</span>
              </div>
            </section>
          </aside>

          <section className={styles.card}>
            <div className={styles.monthGrid}>
              {DOW.map((d) => (
                <div key={d} className={styles.dowCell}>
                  {d}
                </div>
              ))}
              {grid.map(({ date, muted }, i) => {
                if (!date) return <div key={i} className={styles.dayCell} />;
                const isToday =
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();
                return (
                  <div
                    key={i}
                    className={`${styles.dayCell} ${muted ? styles.dayCellMuted : ""}`}
                  >
                    <span
                      className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ""}`}
                    >
                      {date.getDate()}
                    </span>
                    {isToday ? (
                      <div className={styles.calEv}>Today — open calendar</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className={styles.loading} style={{ padding: 14 }}>
              Sync job schedules from Supabase to populate events.{" "}
              <Link href="/jobs">View jobs</Link>
            </p>
          </section>
        </div>
      </div>
    </OfficeShell>
  );
}
