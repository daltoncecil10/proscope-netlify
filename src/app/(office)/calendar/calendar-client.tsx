"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  eventTypeColor,
  formatEventTime,
  listCalendarEvents,
  monthViewRange,
  sameCalendarDay,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/calendar/events";
import {
  formValuesToScheduledAt,
  NewJobModal,
  type NewJobFormValues,
} from "@/components/office/new-job-modal";

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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newEventSaving, setNewEventSaving] = useState(false);
  const [newEventError, setNewEventError] = useState<string | null>(null);
  const [newEventSeedDate, setNewEventSeedDate] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState<CalendarEventType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long" });
  const yearLabel = viewMonth.getFullYear();

  const grid = useMemo(
    () => buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth]
  );

  const visibleEvents = useMemo(() => {
    if (!typeFilter) return events;
    return events.filter((event) => event.eventType === typeFilter);
  }, [events, typeFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const d = new Date(event.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [visibleEvents]);

  const typeCounts = useMemo(() => {
    const counts = { inspection: 0, bei: 0, adjuster: 0, admin: 0 };
    for (const event of events) counts[event.eventType] += 1;
    return counts;
  }, [events]);

  const toggleTypeFilter = (type: CalendarEventType) => {
    setTypeFilter((prev) => (prev === type ? null : type));
  };

  const refreshEvents = useCallback(async () => {
    if (!user?.id) return;
    const { start, end } = monthViewRange(viewMonth);
    setEventsLoading(true);
    setEventsError(null);
    try {
      setEvents(await listCalendarEvents(user.id, start, end));
    } catch (err) {
      setEventsError((err as Error)?.message ?? "Failed to load calendar events");
    } finally {
      setEventsLoading(false);
    }
  }, [user?.id, viewMonth]);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  const shiftMonth = (delta: number) => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const openNewEvent = (seedDate?: Date) => {
    setNewEventError(null);
    setNewEventSeedDate(seedDate);
    setNewEventOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user?.id) return;
    if (!window.confirm("Delete this event? The job will be archived.")) return;
    setDeletingId(eventId);
    try {
      await deleteCalendarEvent(user.id, eventId);
      await refreshEvents();
    } catch (err) {
      window.alert((err as Error)?.message ?? "Failed to delete event");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateEvent = async (values: NewJobFormValues) => {
    if (!user?.id) return;
    setNewEventSaving(true);
    setNewEventError(null);
    try {
      await createCalendarEvent(user.id, {
        title: values.title,
        address: values.address,
        scheduledAt: formValuesToScheduledAt(values),
        eventType: values.eventType,
        notes: values.notes,
      });
      setNewEventOpen(false);
      await refreshEvents();
    } catch (err) {
      setNewEventError((err as Error)?.message ?? "Failed to create event");
    } finally {
      setNewEventSaving(false);
    }
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
        <button type="button" className={styles.btnPrimary} onClick={() => openNewEvent()}>
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
            <button type="button" className={styles.btnSecondary} onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
              Today
            </button>
            <button type="button" className={styles.btnSecondary} onClick={() => shiftMonth(1)}>
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
                  const isToday = sameCalendarDay(date, today);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.miniDay} ${isToday ? styles.miniDayToday : ""}`}
                      style={{
                        opacity: muted ? 0.45 : 1,
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => openNewEvent(date)}
                      title={`Add event on ${date.toLocaleDateString()}`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className={styles.card}>
              <div className={styles.cardHeader}>Event types</div>
              {(
                [
                  ["inspection", "Inspection", "var(--accent)", typeCounts.inspection],
                  ["bei", "BEI / Repairability", "var(--bei)", typeCounts.bei],
                  ["adjuster", "Adjuster", "var(--info)", typeCounts.adjuster],
                  ["admin", "Admin", "var(--ink-mute)", typeCounts.admin],
                ] as const
              ).map(([type, label, color, count]) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.filterRow} ${styles.filterRowBtn} ${
                    typeFilter === type ? styles.filterRowActive : ""
                  }`}
                  onClick={() => toggleTypeFilter(type)}
                >
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={styles.swatch} style={{ background: color }} />
                    {label}
                  </span>
                  <span className={styles.monoMute}>{count}</span>
                </button>
              ))}
            </section>
            <section className={styles.card}>
              <div className={styles.cardHeader}>Account</div>
              <div className={styles.filterRow}>
                <span>{user?.email ?? "Signed in"}</span>
                <span className={styles.monoMute}>{events.length}</span>
              </div>
            </section>
          </aside>

          <section className={styles.card}>
            {eventsError ? <p className={styles.error}>{eventsError}</p> : null}
            {eventsLoading ? (
              <p className={styles.loading} style={{ padding: 14 }}>
                Loading events…
              </p>
            ) : null}
            <div className={styles.monthGrid}>
              {DOW.map((d) => (
                <div key={d} className={styles.dowCell}>
                  {d}
                </div>
              ))}
              {grid.map(({ date, muted }, i) => {
                if (!date) return <div key={i} className={styles.dayCell} />;
                const isToday = sameCalendarDay(date, today);
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const dayEvents = eventsByDay.get(key) ?? [];
                return (
                  <div
                    key={i}
                    className={`${styles.dayCell} ${muted ? styles.dayCellMuted : ""}`}
                    onDoubleClick={() => openNewEvent(date)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openNewEvent(date);
                    }}
                  >
                    <span
                      className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ""}`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className={styles.calEvWrap}>
                        <Link
                          href={`/jobs/${event.id}`}
                          className={`${styles.calEv} ${
                            event.eventType === "bei" ? styles.calEvBei : ""
                          }`}
                          style={{ borderLeftColor: eventTypeColor(event.eventType) }}
                          title={event.address}
                        >
                          <span className={styles.monoMute}>
                            {formatEventTime(event.scheduledAt)}
                          </span>{" "}
                          {event.title}
                        </Link>
                        <button
                          type="button"
                          className={styles.calEvDelete}
                          title="Delete event"
                          disabled={deletingId === event.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleDeleteEvent(event.id);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className={styles.monoMute} style={{ fontSize: 10, padding: "0 4px" }}>
                        +{dayEvents.length - 3} more
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {!eventsLoading && visibleEvents.length === 0 ? (
              <p className={styles.loading} style={{ padding: 14 }}>
                No events this month. Click <strong>+ New event</strong> to schedule a job — it
                will sync to the mobile app.
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <NewJobModal
        open={newEventOpen}
        title="New event"
        initialDate={newEventSeedDate}
        saving={newEventSaving}
        error={newEventError}
        onClose={() => {
          if (!newEventSaving) setNewEventOpen(false);
        }}
        onSubmit={handleCreateEvent}
      />
    </OfficeShell>
  );
}
