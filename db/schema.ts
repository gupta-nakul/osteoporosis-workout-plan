import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  workoutDate: text("workout_date").notNull(),
  planDay: text("plan_day").notNull(),
  sessionType: text("session_type").notNull(),
  startedAtUtc: text("started_at_utc").notNull(),
  startedAtLocal: text("started_at_local").notNull(),
  endedAtUtc: text("ended_at_utc"),
  durationMinutes: integer("duration_minutes"),
  painBefore: integer("pain_before"),
  painAfter: integer("pain_after"),
  worseNextMorning: text("worse_next_morning").notNull().default("unknown"),
  exerciseLog: text("exercise_log").notNull().default("[]"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
