import { env } from "cloudflare:workers";

import {
  defaultPlan,
  reviewedVideoCue,
  type WorkoutPlan,
  type WorkoutSession,
} from "./workout-data";

const PLAN_KEY = "active-plan";
const SELECTED_VIDEOS_KEY = "selected-videos-2026-08-04";
const INTERMEDIATE_PLAN_KEY = "intermediate-plan-2026-08-06";
const GUIDED_TIMERS_PLAN_KEY = "guided-timers-plan-2026-08-08";

function reconcilePlanVideos(plan: WorkoutPlan) {
  let changed = false;
  const defaultsById = new Map(defaultPlan.exercises.map((exercise) => [exercise.id, exercise]));

  const exercises = plan.exercises.map((exercise) => {
    const defaultExercise = defaultsById.get(exercise.id);
    const next = { ...exercise };

    if (!next.videoUrl && defaultExercise?.videoUrl) {
      next.videoUrl = defaultExercise.videoUrl;
      changed = true;
    }

    if ((next.videoUrl || next.id === "easy-walk") && next.cues.includes(reviewedVideoCue)) {
      next.cues = next.cues.filter((cue) => cue !== reviewedVideoCue);
      changed = true;
    }

    return next;
  });

  return { changed, plan: changed ? { ...plan, exercises } : plan };
}

function applyDefaultPlanUpgrade(plan: WorkoutPlan) {
  const defaultsById = new Map(defaultPlan.exercises.map((exercise) => [exercise.id, exercise]));
  const exercises = defaultPlan.exercises.map((defaultExercise) => {
    const existingExercise = plan.exercises.find((exercise) => exercise.id === defaultExercise.id);
    return {
      ...defaultExercise,
      videoUrl: existingExercise?.videoUrl || defaultExercise.videoUrl,
    };
  });

  return {
    ...defaultPlan,
    patientName: plan.patientName || defaultPlan.patientName,
    exercises: exercises.map((exercise) => {
      const defaultExercise = defaultsById.get(exercise.id);
      if ((exercise.videoUrl || exercise.id === "easy-walk") && exercise.cues.includes(reviewedVideoCue)) {
        return { ...exercise, cues: exercise.cues.filter((cue) => cue !== reviewedVideoCue) };
      }
      return defaultExercise ? exercise : exercise;
    }),
  };
}

export function getBinding() {
  if (!env.DB) {
    throw new Error("Database is unavailable for this deployment.");
  }

  return env.DB;
}

export async function ensureTables(db = getBinding()) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS workout_sessions (
        id TEXT PRIMARY KEY,
        workout_date TEXT NOT NULL,
        plan_day TEXT NOT NULL,
        session_type TEXT NOT NULL,
        started_at_utc TEXT NOT NULL,
        started_at_local TEXT NOT NULL,
        ended_at_utc TEXT,
        duration_minutes INTEGER,
        pain_before INTEGER,
        pain_after INTEGER,
        worse_next_morning TEXT NOT NULL DEFAULT 'unknown',
        exercise_log TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS workout_sessions_date_idx ON workout_sessions (workout_date)",
    )
    .run();
}

export async function readPlan(): Promise<WorkoutPlan> {
  const db = getBinding();
  await ensureTables(db);
  const row = await db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind(PLAN_KEY)
    .first<{ value: string }>();

  if (!row?.value) {
    await savePlan(defaultPlan);
    return defaultPlan;
  }

  let storedPlan = JSON.parse(row.value) as WorkoutPlan;
  const selectedVideosApplied = await db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind(SELECTED_VIDEOS_KEY)
    .first<{ value: string }>();

  if (!selectedVideosApplied?.value) {
    const reconciled = reconcilePlanVideos(storedPlan);
    storedPlan = reconciled.plan;
    if (reconciled.changed) {
      await savePlan(storedPlan);
    }
    await db
      .prepare(
        `INSERT INTO app_state (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(SELECTED_VIDEOS_KEY, "true")
      .run();
  }

  const intermediatePlanApplied = await db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind(INTERMEDIATE_PLAN_KEY)
    .first<{ value: string }>();

  if (!intermediatePlanApplied?.value) {
    storedPlan = applyDefaultPlanUpgrade(storedPlan);
    await savePlan(storedPlan);
    await db
      .prepare(
        `INSERT INTO app_state (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(INTERMEDIATE_PLAN_KEY, "true")
      .run();
  }

  const guidedTimersPlanApplied = await db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .bind(GUIDED_TIMERS_PLAN_KEY)
    .first<{ value: string }>();

  if (!guidedTimersPlanApplied?.value) {
    storedPlan = applyDefaultPlanUpgrade(storedPlan);
    await savePlan(storedPlan);
    await db
      .prepare(
        `INSERT INTO app_state (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(GUIDED_TIMERS_PLAN_KEY, "true")
      .run();
  }

  return storedPlan;
}

export async function savePlan(plan: WorkoutPlan) {
  const db = getBinding();
  await ensureTables(db);
  const value = JSON.stringify({ ...plan, updatedAt: new Date().toISOString() });
  await db
    .prepare(
      `INSERT INTO app_state (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(PLAN_KEY, value)
    .run();
}

export async function listSessions(): Promise<WorkoutSession[]> {
  const db = getBinding();
  await ensureTables(db);
  const result = await db
    .prepare(
      `SELECT id, workout_date, plan_day, session_type, started_at_utc,
        started_at_local, ended_at_utc, duration_minutes, pain_before,
        pain_after, worse_next_morning, exercise_log, notes
       FROM workout_sessions
       ORDER BY workout_date DESC, started_at_utc DESC
       LIMIT 60`,
    )
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    workoutDate: String(row.workout_date),
    planDay: String(row.plan_day),
    sessionType: String(row.session_type),
    startedAtUtc: String(row.started_at_utc),
    startedAtLocal: String(row.started_at_local),
    endedAtUtc: row.ended_at_utc ? String(row.ended_at_utc) : undefined,
    durationMinutes:
      typeof row.duration_minutes === "number" ? row.duration_minutes : undefined,
    painBefore: typeof row.pain_before === "number" ? row.pain_before : undefined,
    painAfter: typeof row.pain_after === "number" ? row.pain_after : undefined,
    worseNextMorning:
      row.worse_next_morning === "yes" || row.worse_next_morning === "no"
        ? row.worse_next_morning
        : "unknown",
    exerciseLog: JSON.parse(String(row.exercise_log ?? "[]")),
    notes: String(row.notes ?? ""),
  }));
}

export async function saveSession(session: WorkoutSession) {
  const db = getBinding();
  await ensureTables(db);
  await db
    .prepare(
      `INSERT INTO workout_sessions (
        id, workout_date, plan_day, session_type, started_at_utc,
        started_at_local, ended_at_utc, duration_minutes, pain_before,
        pain_after, worse_next_morning, exercise_log, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ended_at_utc = excluded.ended_at_utc,
        duration_minutes = excluded.duration_minutes,
        pain_before = excluded.pain_before,
        pain_after = excluded.pain_after,
        worse_next_morning = excluded.worse_next_morning,
        exercise_log = excluded.exercise_log,
        notes = excluded.notes`,
    )
    .bind(
      session.id,
      session.workoutDate,
      session.planDay,
      session.sessionType,
      session.startedAtUtc,
      session.startedAtLocal,
      session.endedAtUtc ?? null,
      session.durationMinutes ?? null,
      session.painBefore ?? null,
      session.painAfter ?? null,
      session.worseNextMorning ?? "unknown",
      JSON.stringify(session.exerciseLog ?? []),
      session.notes ?? "",
    )
    .run();
}
