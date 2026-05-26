import { supabase } from "@/lib/supabase/client";

export type CalendarEventType = "inspection" | "bei" | "adjuster" | "admin";

export type CalendarEvent = {
  id: string;
  title: string;
  address: string;
  scheduledAt: string;
  eventType: CalendarEventType;
  notes: string;
};

const TYPE_PREFIX = /^\[type:(inspection|bei|adjuster|admin)\]\n?/;

export function encodeEventNotes(type: CalendarEventType, notes: string): string {
  const body = notes.trim();
  return body ? `[type:${type}]\n${body}` : `[type:${type}]`;
}

export function parseEventType(notes: string | null): CalendarEventType {
  const match = notes?.match(TYPE_PREFIX);
  const value = match?.[1];
  if (value === "bei" || value === "adjuster" || value === "admin") return value;
  return "inspection";
}

export function stripEventNotes(notes: string | null): string {
  return (notes ?? "").replace(TYPE_PREFIX, "").trim();
}

function mapRow(row: {
  id: string;
  title: string | null;
  address: string | null;
  scheduled_at: string | null;
  notes: string | null;
}): CalendarEvent | null {
  if (!row.scheduled_at) return null;
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled",
    address: row.address?.trim() || "",
    scheduledAt: row.scheduled_at,
    eventType: parseEventType(row.notes),
    notes: stripEventNotes(row.notes),
  };
}

export async function listCalendarEvents(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,title,address,scheduled_at,notes")
    .eq("user_id", userId)
    .eq("archived", false)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", rangeStart.toISOString())
    .lte("scheduled_at", rangeEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Parameters<typeof mapRow>[0][])
    .map(mapRow)
    .filter((event): event is CalendarEvent => event !== null);
}

export type CreateCalendarEventInput = {
  title: string;
  address: string;
  scheduledAt: Date;
  eventType: CalendarEventType;
  notes?: string;
};

export async function createCalendarEvent(
  userId: string,
  input: CreateCalendarEventInput
): Promise<CalendarEvent> {
  const title = input.title.trim();
  const address = input.address.trim();
  if (!title) throw new Error("Title is required.");
  if (!address) throw new Error("Address is required.");

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      title,
      address,
      scheduled_at: input.scheduledAt.toISOString(),
      status: "scheduled",
      archived: false,
      notes: encodeEventNotes(input.eventType, input.notes ?? ""),
      adjuster: null,
      stage_id: null,
    })
    .select("id,title,address,scheduled_at,notes")
    .single();

  if (error) throw error;
  const event = mapRow(data as Parameters<typeof mapRow>[0]);
  if (!event) throw new Error("Failed to create event.");
  return event;
}

export function eventTypeLabel(type: CalendarEventType): string {
  switch (type) {
    case "bei":
      return "BEI / Repairability";
    case "adjuster":
      return "Adjuster";
    case "admin":
      return "Admin";
    default:
      return "Inspection";
  }
}

export function eventTypeColor(type: CalendarEventType): string {
  switch (type) {
    case "bei":
      return "var(--bei)";
    case "adjuster":
      return "var(--info)";
    case "admin":
      return "var(--ink-mute)";
    default:
      return "var(--accent)";
  }
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function monthViewRange(viewMonth: Date): { start: Date; end: Date } {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Archive (soft-delete) a calendar event / job. */
export async function deleteCalendarEvent(userId: string, jobId: string): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ archived: true })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (error) throw error;
}
