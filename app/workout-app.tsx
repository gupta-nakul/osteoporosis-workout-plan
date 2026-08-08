"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { Exercise, ExerciseLog, WorkoutPlan, WorkoutSession } from "./lib/workout-data";

type AuthUser = {
  email: string;
  role: "admin" | "viewer";
};

const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const categoryLabels: Record<Exercise["category"], string> = {
  warmup: "Warm-up",
  strength: "Strength",
  balance: "Balance",
  posture: "Posture",
  walking: "Walking",
};
const exerciseStatusLabels: Record<ExerciseLog["status"], string> = {
  completed: "Done",
  skipped: "Skipped",
  painful: "Pain stop",
};
const accountOptions = [
  { label: "Patient", email: "patient@example.com", helper: "Workout access" },
  { label: "Admin", email: "admin@example.com", helper: "Plan editor" },
];
const defaultRestSeconds = 30;

type PreviewState = {
  exerciseId: string;
  exerciseIds: string[];
  label: string;
};

type TimerConfig = NonNullable<Exercise["timer"]>;
type GuidedTimerPhase = "work" | "rest" | "complete";
type GuidedTimerState = {
  exerciseId: string;
  phase: GuidedTimerPhase;
  setIndex: number;
  endsAt: number | null;
};

let dingAudioContext: AudioContext | null = null;

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  dingAudioContext ??= new AudioContextConstructor();
  return dingAudioContext;
}

function primeDing() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    void context.resume();
  }
}

function playDing() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume();
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.48);
}

function createTimerState(exercise: Exercise, now = Date.now()): GuidedTimerState | null {
  if (!exercise.timer) return null;
  return {
    exerciseId: exercise.id,
    phase: "work",
    setIndex: 0,
    endsAt: exercise.timer.workSeconds ? now + exercise.timer.workSeconds * 1000 : null,
  };
}

function timerTotalSeconds(config: TimerConfig, phase: GuidedTimerPhase) {
  if (phase === "rest") return config.restSeconds ?? defaultRestSeconds;
  if (phase === "work") return config.workSeconds ?? 0;
  return 0;
}

function getIstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    displayDate: `${get("day")}/${get("month")}/${get("year")}`,
    time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`,
  };
}

function dayKeyFromWeekday(weekday: string) {
  return weekday.toLowerCase();
}

function toLocalIsoInIst(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+05:30`;
}

function videoEmbedUrl(url: string) {
  if (!url.trim()) return "";

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${parsed.pathname.split("/")[2]}`;
      }
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      if (parsed.pathname.startsWith("/embed/")) return url;
    }
  } catch {
    return "";
  }

  return "";
}

function emptySession(planDay: string, sessionType: string, workoutDate: string): WorkoutSession {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    workoutDate,
    planDay,
    sessionType,
    startedAtUtc: now.toISOString(),
    startedAtLocal: toLocalIsoInIst(now),
    worseNextMorning: "unknown",
    exerciseLog: [],
  };
}

export function WorkoutApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeTab, setActiveTab] = useState<"today" | "plan" | "history" | "admin">("today");
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [reviewingSession, setReviewingSession] = useState<WorkoutSession | null>(null);
  const [painBefore, setPainBefore] = useState(0);
  const [painAfter, setPainAfter] = useState(0);
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [clock, setClock] = useState(getIstParts());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(getIstParts()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const meResponse = await fetch("/api/auth/me", { credentials: "include" });
        if (!meResponse.ok) {
          setAuthChecked(true);
          return;
        }
        const meData = (await meResponse.json()) as { user: AuthUser };
        setUser(meData.user);
        await loadPrivateData();
      } catch {
        setSaveState("Offline preview");
      } finally {
        setAuthChecked(true);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (user?.role !== "admin" && activeTab === "admin") {
      setActiveTab("today");
    }
  }, [activeTab, user]);

  const todayKey = dayKeyFromWeekday(clock.weekday);
  const today = plan ? (plan.days[todayKey] ?? plan.days.monday) : null;
  const exerciseMap = useMemo(() => {
    if (!plan) return {} as Record<string, Exercise>;
    return Object.fromEntries(plan.exercises.map((exercise) => [exercise.id, exercise])) as Record<string, Exercise>;
  }, [plan]);
  const todayExercises = today ? today.exerciseIds.map((id) => exerciseMap[id]).filter(Boolean) : [];
  const currentExercise = todayExercises[stepIndex];
  const previewExercise = previewState ? exerciseMap[previewState.exerciseId] : undefined;
  const previewExercises = previewState
    ? previewState.exerciseIds.map((id) => exerciseMap[id]).filter(Boolean)
    : todayExercises;
  const previewIndex = previewExercise
    ? Math.max(0, previewExercises.findIndex((exercise) => exercise.id === previewExercise.id))
    : 0;
  const completedToday = sessions.find((session) => session.workoutDate === clock.date);

  function openExercisePreview(exerciseId: string, exerciseIds: string[], label: string) {
    setPreviewState({ exerciseId, exerciseIds, label });
  }

  async function loadPrivateData() {
    const [planResponse, sessionResponse] = await Promise.all([
      fetch("/api/plan", { credentials: "include" }),
      fetch("/api/sessions", { credentials: "include" }),
    ]);
    if (planResponse.ok) {
      const data = (await planResponse.json()) as { plan: WorkoutPlan };
      setPlan(data.plan);
    }
    if (sessionResponse.ok) {
      const data = (await sessionResponse.json()) as { sessions: WorkoutSession[] };
      setSessions(data.sessions);
    }
  }

  async function signIn(email: string, password: string) {
    setSaveState("Signing in...");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      setSaveState("Sign in failed");
      return "Email or password is incorrect.";
    }
    const data = (await response.json()) as { user: AuthUser };
    await loadPrivateData();
    setUser(data.user);
    setSaveState("Saved");
    return "";
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setPlan(null);
    setSessions([]);
    setActiveTab("today");
  }

  if (!authChecked) {
    return (
      <main className="app-shell login-shell">
        <section className="login-panel">
          <p className="eyebrow">Private care plan</p>
          <h1>Osteoporosis Workout Plan</h1>
          <p>Checking access...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} />;
  }

  if (!plan || !today) {
    return (
      <main className="app-shell login-shell">
        <section className="login-panel">
          <p className="eyebrow">Private care plan</p>
          <h1>Osteoporosis Workout Plan</h1>
          <p>Loading workout plan...</p>
        </section>
      </main>
    );
  }

  async function persistSession(session: WorkoutSession) {
    setSaveState("Saving...");
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session }),
    });
    if (!response.ok) throw new Error("Unable to save session");
    const data = (await response.json()) as { sessions: WorkoutSession[] };
    setSessions(data.sessions);
    setSaveState("Saved");
  }

  function startSession() {
    primeDing();
    setPainAfter(0);
    setNote("");
    setStepIndex(0);
    setPreviewState(null);
    setReviewingSession(null);
    setActiveSession({
      ...emptySession(today.label, today.type, clock.date),
      painBefore,
    });
  }

  function markExercise(status: ExerciseLog["status"]) {
    if (!activeSession || !currentExercise) return;
    const updated: WorkoutSession = {
      ...activeSession,
      exerciseLog: [
        ...activeSession.exerciseLog.filter((item) => item.exerciseId !== currentExercise.id),
        {
          exerciseId: currentExercise.id,
          status,
          completedAtUtc: new Date().toISOString(),
          skipReason: status === "completed" ? undefined : status === "painful" ? "Pain or symptoms increased" : "Skipped",
        },
      ],
    };
    setActiveSession(updated);

    if (stepIndex < todayExercises.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }

    setReviewingSession(updated);
  }

  async function finishWorkout() {
    if (!reviewingSession) return;
    const ended = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round((ended.getTime() - new Date(reviewingSession.startedAtUtc).getTime()) / 60_000),
    );
    const finalSession = {
      ...reviewingSession,
      endedAtUtc: ended.toISOString(),
      durationMinutes,
      painAfter,
      notes: note,
    };
    await persistSession(finalSession);
    setActiveSession(null);
    setReviewingSession(null);
    setPreviewState(null);
  }

  function backToCurrentExercise() {
    setReviewingSession(null);
  }

  async function savePlanUpdate(nextPlan: WorkoutPlan) {
    setSaveState("Saving...");
    setPlan(nextPlan);
    const response = await fetch("/api/plan", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan: nextPlan }),
    });
    if (!response.ok) {
      setSaveState("Save failed");
      return;
    }
    const data = (await response.json()) as { plan: WorkoutPlan };
    setPlan(data.plan);
    setSaveState("Saved");
  }

  return (
    <main className={activeSession ? "app-shell focus-shell" : "app-shell"} id="main-content" tabIndex={-1}>
      <a className="skip-link" href="#today-content">
        Skip to workout
      </a>
      <section className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Osteoporosis Workout Plan</p>
          <h1>{reviewingSession ? "Review and save" : activeSession && currentExercise ? currentExercise.name : today.type}</h1>
          <p className="date-line">
            {clock.weekday}, {clock.displayDate} at {clock.time} IST
          </p>
        </div>
        <div className="status-stack" aria-label="Plan status">
          <div className="status-box" aria-live="polite">
            <span>Status</span>
            <strong>{saveState}</strong>
          </div>
          <div className="status-box">
            <span>{user.role === "admin" ? "Editor" : "Access"}</span>
            <strong>{today.estimate}</strong>
          </div>
        </div>
      </section>

      {!activeSession && (
        <nav className="tabs" aria-label="App sections">
          <button className={activeTab === "today" ? "active" : ""} onClick={() => setActiveTab("today")}>
            Today
          </button>
          <button className={activeTab === "plan" ? "active" : ""} onClick={() => setActiveTab("plan")}>
            Plan
          </button>
          <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
            History
          </button>
          {user.role === "admin" ? (
            <button className={activeTab === "admin" ? "active" : ""} onClick={() => setActiveTab("admin")}>
              Edit Plan
            </button>
          ) : (
            <button onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </nav>
      )}

      {activeTab === "today" && (
        <section className="content-grid" id="today-content">
          <div className="primary-panel today-panel">
            {!activeSession ? (
              <>
                <div className="session-header">
                  <div>
                    <p className="eyebrow">Today for {plan.patientName.split(" ")[0]}</p>
                    <h2>{today.type}</h2>
                  </div>
                  <span className={completedToday ? "pill done" : "pill"}>
                    {completedToday ? "Completed" : today.exerciseIds.length ? "Ready" : "Rest"}
                  </span>
                </div>

                {today.exerciseIds.length ? (
                  <>
                    <div className="today-summary">
                      <div>
                        <span>Exercises</span>
                        <strong>{todayExercises.length}</strong>
                      </div>
                      <div>
                        <span>Time</span>
                        <strong>{today.estimate}</strong>
                      </div>
                      <div>
                        <span>Mode</span>
                        <strong>Guided</strong>
                      </div>
                    </div>
                    <label className="pain-picker">
                      <span>Pain before starting</span>
                      <input
                        min="0"
                        max="10"
                        type="range"
                        value={painBefore}
                        onChange={(event) => setPainBefore(Number(event.target.value))}
                      />
                      <strong>{painBefore}/10</strong>
                    </label>
                    <div className="exercise-preview-list" aria-label="Today's exercises">
                      {todayExercises.map((exercise, index) => {
                        const todayLog = completedToday?.exerciseLog.find((item) => item.exerciseId === exercise.id);
                        return (
                          <button
                            className={todayLog ? `exercise-preview ${todayLog.status}` : "exercise-preview"}
                            key={exercise.id}
                            onClick={() => openExercisePreview(exercise.id, today.exerciseIds, "Today preview")}
                            type="button"
                          >
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <strong>{exercise.name}</strong>
                            <small>{todayLog ? exerciseStatusLabels[todayLog.status] : exercise.dose}</small>
                          </button>
                        );
                      })}
                    </div>
                    <button className="primary-action" onClick={startSession}>
                      Start workout
                    </button>
                  </>
                ) : (
                  <div className="rest-state">
                    <strong>Sunday off</strong>
                    <span>Rest day. Keep normal spine precautions.</span>
                  </div>
                )}
              </>
            ) : reviewingSession ? (
              <WorkoutReview
                exerciseMap={exerciseMap}
                painAfter={painAfter}
                session={reviewingSession}
                note={note}
                onBack={backToCurrentExercise}
                onFinish={() => void finishWorkout()}
                onPainAfterChange={setPainAfter}
                onNoteChange={setNote}
              />
            ) : (
              currentExercise && (
                <WorkoutPlayer
                  currentExercise={currentExercise}
                  exerciseLog={activeSession.exerciseLog}
                  exercises={todayExercises}
                  onMark={markExercise}
                  onPreview={(exerciseId) => openExercisePreview(exerciseId, today.exerciseIds, "Workout preview")}
                  stepIndex={stepIndex}
                />
              )
            )}
          </div>

          <aside className="side-panel">
            <div className="side-header">
              <span>Before starting</span>
              <strong>Safety checklist</strong>
            </div>
            <details open>
              <summary>Daily rules</summary>
              <ul>
                {plan.safetyRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </details>
            <details>
              <summary>Stop and call the doctor if</summary>
              <ul>
                {plan.urgentRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </details>
          </aside>

          <section className="week-strip">
            {dayOrder.map((key) => {
              const day = plan.days[key];
              return (
                <div className={key === todayKey ? "day-card current" : "day-card"} key={key}>
                  <span>{day.label.slice(0, 3)}</span>
                  <strong>{day.type}</strong>
                  <small>{day.estimate}</small>
                </div>
              );
            })}
          </section>
        </section>
      )}
      {previewExercise ? (
        <ExercisePreviewSheet
          exercise={previewExercise}
          index={previewIndex}
          label={previewState?.label ?? "Exercise preview"}
          onClose={() => setPreviewState(null)}
          total={previewExercises.length}
        />
      ) : null}

      {activeTab === "plan" && (
        <PlanBrowser
          completedToday={completedToday}
          exerciseMap={exerciseMap}
          onPreview={(exerciseId, exerciseIds, label) => openExercisePreview(exerciseId, exerciseIds, label)}
          plan={plan}
          todayKey={todayKey}
        />
      )}
      {activeTab === "history" && (
        <History
          exerciseMap={exerciseMap}
          onPreview={(exerciseId, exerciseIds, label) => openExercisePreview(exerciseId, exerciseIds, label)}
          sessions={sessions}
          onUpdate={(session) => void persistSession(session)}
        />
      )}
      {activeTab === "admin" && (
        <AdminPlan plan={plan} onSave={(nextPlan) => void savePlanUpdate(nextPlan)} />
      )}
      {user.role === "admin" && (
        <button className="floating-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      )}
    </main>
  );
}

function WorkoutPlayer({
  currentExercise,
  exerciseLog,
  exercises,
  onMark,
  onPreview,
  stepIndex,
}: {
  currentExercise: Exercise;
  exerciseLog: ExerciseLog[];
  exercises: Exercise[];
  onMark: (status: ExerciseLog["status"]) => void;
  onPreview: (exerciseId: string) => void;
  stepIndex: number;
}) {
  const nextExercise = exercises[stepIndex + 1];
  const completedIds = new Set(exerciseLog.map((item) => item.exerciseId));
  const remainingCount = Math.max(0, exercises.length - stepIndex - 1);
  const timerConfig = currentExercise.timer;
  const [timerState, setTimerState] = useState<GuidedTimerState | null>(() => createTimerState(currentExercise));
  const [timerNow, setTimerNow] = useState(Date.now());

  useEffect(() => {
    const now = Date.now();
    setTimerNow(now);
    setTimerState(createTimerState(currentExercise, now));
  }, [currentExercise, stepIndex]);

  useEffect(() => {
    if (!timerState?.endsAt) return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [timerState?.endsAt]);

  const secondsRemaining = timerState?.endsAt
    ? Math.max(0, Math.ceil((timerState.endsAt - timerNow) / 1000))
    : 0;
  const phaseTotalSeconds = timerConfig && timerState ? timerTotalSeconds(timerConfig, timerState.phase) : 0;

  function startWorkSet(setIndex: number) {
    if (!timerConfig) return;
    const now = Date.now();
    setTimerNow(now);
    setTimerState({
      exerciseId: currentExercise.id,
      phase: "work",
      setIndex,
      endsAt: timerConfig.workSeconds ? now + timerConfig.workSeconds * 1000 : null,
    });
  }

  function finishCurrentSet() {
    if (!timerConfig || !timerState) return;
    const nextSetIndex = timerState.setIndex + 1;

    if (nextSetIndex >= timerConfig.sets) {
      setTimerState({
        exerciseId: currentExercise.id,
        phase: "complete",
        setIndex: timerState.setIndex,
        endsAt: null,
      });
      return;
    }

    const restSeconds = timerConfig.restSeconds ?? defaultRestSeconds;
    if (!restSeconds) {
      startWorkSet(nextSetIndex);
      return;
    }

    const now = Date.now();
    setTimerNow(now);
    setTimerState({
      exerciseId: currentExercise.id,
      phase: "rest",
      setIndex: timerState.setIndex,
      endsAt: now + restSeconds * 1000,
    });
  }

  function restartTimer() {
    const now = Date.now();
    setTimerNow(now);
    setTimerState(createTimerState(currentExercise, now));
  }

  function handlePrimaryAction() {
    if (!timerConfig || !timerState) {
      onMark("completed");
      return;
    }

    if (timerState.phase === "rest") {
      startWorkSet(timerState.setIndex + 1);
      return;
    }

    if (timerState.phase === "complete") {
      onMark("completed");
      return;
    }

    if (timerConfig.sets === 1 && timerConfig.workSeconds) {
      onMark("completed");
      return;
    }

    finishCurrentSet();
  }

  useEffect(() => {
    if (!timerConfig || !timerState?.endsAt || secondsRemaining > 0) return;
    playDing();

    if (timerState.phase === "work") {
      finishCurrentSet();
      return;
    }

    if (timerState.phase === "rest") {
      startWorkSet(timerState.setIndex + 1);
    }
  }, [secondsRemaining, timerConfig, timerState]);

  const primaryActionLabel = !timerConfig || !timerState
    ? "Mark done"
    : timerState.phase === "rest"
      ? "Skip recovery"
      : timerState.phase === "complete"
        ? currentExercise.id === "easy-walk" ? "Mark walk done" : "Mark done"
        : timerConfig.sets > 1
          ? `Set ${timerState.setIndex + 1} done`
          : currentExercise.id === "easy-walk" ? "Mark walk done" : "Mark done";

  return (
    <section className="workout-player">
      <div className="player-topline">
        <div className="progress-panel" aria-label="Workout progress">
          <span>
            Step {stepIndex + 1} of {exercises.length}
          </span>
          <div>
            <i style={{ width: `${((stepIndex + 1) / Math.max(1, exercises.length)) * 100}%` }} />
          </div>
        </div>
        {nextExercise ? (
          <button className="next-chip" type="button" onClick={() => onPreview(nextExercise.id)}>
            Next: {nextExercise.name}
          </button>
        ) : (
          <span className="next-chip muted">Final exercise</span>
        )}
      </div>

      <div className="player-session-strip" aria-label="Workout session details">
        <div>
          <span>Completed</span>
          <strong>
            {exerciseLog.length}/{exercises.length}
          </strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{remainingCount}</strong>
        </div>
        <div>
          <span>Focus</span>
          <strong>Slow, supported reps</strong>
        </div>
      </div>

      <div className="player-hero">
        <div className="player-video">
          {timerConfig && timerState ? (
            <GuidedTimerPanel
              config={timerConfig}
              onRestart={restartTimer}
              phaseTotalSeconds={phaseTotalSeconds}
              secondsRemaining={secondsRemaining}
              state={timerState}
            />
          ) : (
            <ExerciseVideo exercise={currentExercise} />
          )}
        </div>
        <div className="player-current">
          <p className="eyebrow">Current exercise</p>
          <h2>{currentExercise.name}</h2>
          <span className="pill">{categoryLabels[currentExercise.category]}</span>
          <div className="dose-line">
            <div>
              <span>Dose</span>
              <strong>{currentExercise.dose}</strong>
            </div>
            <div>
              <span>Equipment</span>
              <strong>{currentExercise.equipment}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="player-guidance">
        <section className="cue-panel">
          <h3>Cues</h3>
          <ul>
            {currentExercise.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </section>
        <section className="cue-panel stop-panel">
          <h3>Stop if</h3>
          <ul>
            {currentExercise.stopRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </div>

      <ExerciseQueue
        completedIds={completedIds}
        currentId={currentExercise.id}
        exercises={exercises}
        onPreview={onPreview}
      />

      <div className="workout-action-bar" aria-label="Exercise actions">
        <button onClick={handlePrimaryAction}>{primaryActionLabel}</button>
        <button onClick={() => onMark("skipped")}>Skip exercise</button>
        <button className="danger" onClick={() => onMark("painful")}>Record pain</button>
      </div>
    </section>
  );
}

function GuidedTimerPanel({
  config,
  onRestart,
  phaseTotalSeconds,
  secondsRemaining,
  state,
}: {
  config: TimerConfig;
  onRestart: () => void;
  phaseTotalSeconds: number;
  secondsRemaining: number;
  state: GuidedTimerState;
}) {
  const isUntimedWork = state.phase === "work" && !config.workSeconds;
  const progress = phaseTotalSeconds > 0
    ? Math.max(0, Math.min(1, 1 - secondsRemaining / phaseTotalSeconds))
    : 0;
  const phaseLabel = state.phase === "rest"
    ? "Recovery"
    : state.phase === "complete"
      ? "Complete"
      : config.workLabel ?? "Set";
  const timerText = state.phase === "complete" ? "Done" : isUntimedWork ? "Ready" : formatTimer(secondsRemaining);
  const detail = state.phase === "complete"
    ? "Timer complete. Tap Mark done when she is safely ready."
    : state.phase === "rest"
      ? `${config.restSeconds ?? defaultRestSeconds} second recovery before the next set.`
      : isUntimedWork
        ? "Complete this set at a slow, supported pace. Recovery starts after Set done."
        : "Timer started automatically for this set.";

  return (
    <div
      className={
        state.phase === "complete"
          ? "guided-timer done"
          : state.phase === "rest"
            ? "guided-timer rest"
            : "guided-timer"
      }
      aria-live="polite"
    >
      <span>{phaseLabel}</span>
      <strong>{timerText}</strong>
      <small>
        Set {state.setIndex + 1} of {config.sets}
      </small>
      <div className="timer-track" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <p>{detail}</p>
      <button type="button" onClick={onRestart}>
        Restart exercise timer
      </button>
    </div>
  );
}

function ExerciseQueue({
  completedIds,
  currentId,
  exercises,
  onPreview,
}: {
  completedIds: Set<string>;
  currentId: string;
  exercises: Exercise[];
  onPreview: (exerciseId: string) => void;
}) {
  return (
    <section className="queue-panel" aria-label="Workout queue">
      <div className="queue-header">
        <div>
          <p className="eyebrow">Workout path</p>
          <h3>Coming up</h3>
        </div>
        <span>{exercises.length} movements</span>
      </div>
      <div className="queue-list">
        {exercises.map((exercise, index) => {
          const isCurrent = exercise.id === currentId;
          const isDone = completedIds.has(exercise.id);
          return (
            <button
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Preview ${exercise.name}`}
              className={isCurrent ? "queue-item current" : isDone ? "queue-item done" : "queue-item"}
              key={exercise.id}
              onClick={() => onPreview(exercise.id)}
              type="button"
            >
              <span>{isDone ? "Done" : String(index + 1).padStart(2, "0")}</span>
              <strong>{exercise.name}</strong>
              <small>{isCurrent ? "Now" : exercise.dose}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WorkoutReview({
  exerciseMap,
  note,
  onBack,
  onFinish,
  onNoteChange,
  onPainAfterChange,
  painAfter,
  session,
}: {
  exerciseMap: Record<string, Exercise>;
  note: string;
  onBack: () => void;
  onFinish: () => void;
  onNoteChange: (value: string) => void;
  onPainAfterChange: (value: number) => void;
  painAfter: number;
  session: WorkoutSession;
}) {
  const completed = session.exerciseLog.filter((item) => item.status === "completed").length;
  const skipped = session.exerciseLog.filter((item) => item.status === "skipped").length;
  const painful = session.exerciseLog.filter((item) => item.status === "painful").length;

  return (
    <section className="review-panel">
      <div className="session-header">
        <div>
          <p className="eyebrow">Finish workout</p>
          <h2>Review and save</h2>
        </div>
        <span className="pill">Almost done</span>
      </div>

      <div className="today-summary">
        <div>
          <span>Done</span>
          <strong>{completed}</strong>
        </div>
        <div>
          <span>Skipped</span>
          <strong>{skipped}</strong>
        </div>
        <div>
          <span>Pain stops</span>
          <strong>{painful}</strong>
        </div>
      </div>

      <div className="review-list">
        {session.exerciseLog.map((item, index) => (
          <div className={item.status === "painful" ? "review-item painful" : "review-item"} key={item.exerciseId}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{exerciseMap[item.exerciseId]?.name ?? item.exerciseId}</strong>
            <small>{item.status}</small>
          </div>
        ))}
      </div>

      <label className="pain-picker">
        <span>Pain after workout</span>
        <input
          min="0"
          max="10"
          type="range"
          value={painAfter}
          onChange={(event) => onPainAfterChange(Number(event.target.value))}
        />
        <strong>{painAfter}/10</strong>
      </label>
      <textarea
        aria-label="Workout note"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Optional note for the admin or doctor"
      />

      <div className="review-actions">
        <button type="button" onClick={onBack}>Back to exercise</button>
        <button className="primary-action compact" type="button" onClick={onFinish}>Save workout</button>
      </div>
    </section>
  );
}

function ExercisePreviewSheet({
  exercise,
  index,
  label,
  onClose,
  total,
}: {
  exercise: Exercise;
  index: number;
  label: string;
  onClose: () => void;
  total: number;
}) {
  return (
    <div className="preview-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-label={`${exercise.name} preview`}
        aria-modal="true"
        className="preview-sheet"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-header">
          <div>
            <p className="eyebrow">
              {label} - {index + 1} of {total}
            </p>
            <h2>{exercise.name}</h2>
          </div>
          <button aria-label="Close exercise preview" type="button" onClick={onClose}>Close</button>
        </div>
        <ExerciseDemo exercise={exercise} compact />
      </section>
    </div>
  );
}

function PlanBrowser({
  completedToday,
  exerciseMap,
  onPreview,
  plan,
  todayKey,
}: {
  completedToday?: WorkoutSession;
  exerciseMap: Record<string, Exercise>;
  onPreview: (exerciseId: string, exerciseIds: string[], label: string) => void;
  plan: WorkoutPlan;
  todayKey: string;
}) {
  return (
    <section className="plan-browser" id="today-content">
      <div className="history-header">
        <div>
          <p className="eyebrow">Browse plan</p>
          <h2>Weekly workout library</h2>
        </div>
        <span>Preview any movement without logging it</span>
      </div>

      <div className="plan-day-grid">
        {dayOrder.map((dayId) => {
          const day = plan.days[dayId];
          const exercises = day.exerciseIds.map((id) => exerciseMap[id]).filter(Boolean);
          const isToday = dayId === todayKey;
          return (
            <section className={isToday ? "plan-day-card current" : "plan-day-card"} key={dayId}>
              <div className="plan-day-header">
                <div>
                  <span>{day.label}</span>
                  <strong>{day.type}</strong>
                </div>
                <small>{day.estimate}</small>
              </div>

              {exercises.length ? (
                <div className="plan-exercise-list">
                  {exercises.map((exercise, index) => {
                    const todayLog = isToday
                      ? completedToday?.exerciseLog.find((item) => item.exerciseId === exercise.id)
                      : undefined;
                    return (
                      <button
                        className={todayLog ? `plan-exercise ${todayLog.status}` : "plan-exercise"}
                        key={exercise.id}
                        onClick={() => onPreview(exercise.id, day.exerciseIds, `${day.label} preview`)}
                        type="button"
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{exercise.name}</strong>
                        <small>{todayLog ? exerciseStatusLabels[todayLog.status] : exercise.dose}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rest-state compact">
                  <strong>Rest day</strong>
                  <span>No planned workout.</span>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<string> }) {
  const [email, setEmail] = useState(accountOptions[0].email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const message = await onSignIn(email, password);
    setError(message);
    setBusy(false);
  }

  return (
    <main className="app-shell login-shell">
      <form className="login-panel" onSubmit={(event) => void submit(event)}>
        <div className="login-brand">
          <p className="eyebrow">Private family app</p>
          <h1>Osteoporosis Workout Plan</h1>
          <p className="login-copy">Choose an account, then enter the password.</p>
        </div>
        <div className="account-switcher" aria-label="Choose account">
          {accountOptions.map((account) => (
            <button
              className={email === account.email ? "account-card selected" : "account-card"}
              key={account.email}
              onClick={() => setEmail(account.email)}
              type="button"
            >
              <span>{account.label.slice(0, 1)}</span>
              <strong>{account.label}</strong>
              <small>{account.helper}</small>
            </button>
          ))}
        </div>
        <input name="email" type="hidden" value={email} />
        <label>
          <span>Password</span>
          <div className="password-field">
            <input
              autoComplete="current-password"
              name="password"
              spellCheck={false}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button className="primary-action" disabled={busy} type="submit">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function ExerciseVideo({ exercise }: { exercise: Exercise }) {
  const embed = videoEmbedUrl(exercise.videoUrl);

  return (
    <div className="video-box">
      {embed ? (
        <iframe
          title={`${exercise.name} demo`}
          src={embed}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div className="video-placeholder">
          <strong>No demo video</strong>
          <span>Use the written cues for this movement.</span>
        </div>
      )}
    </div>
  );
}

function ExerciseDemo({ compact = false, exercise }: { compact?: boolean; exercise: Exercise }) {
  return (
    <div className={compact ? "exercise-demo compact" : "exercise-demo"}>
      <ExerciseVideo exercise={exercise} />
      <div className="exercise-copy">
        <div className="dose-line">
          <div>
            <span>Dose</span>
            <strong>{exercise.dose}</strong>
          </div>
          <div>
            <span>Equipment</span>
            <strong>{exercise.equipment}</strong>
          </div>
        </div>
        <section className="cue-panel">
          <h3>Cues</h3>
          <ul>
            {exercise.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </section>
        <section className="cue-panel stop-panel">
          <h3>Stop if</h3>
          <ul>
            {exercise.stopRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function History({
  exerciseMap,
  onPreview,
  sessions,
  onUpdate,
}: {
  exerciseMap: Record<string, Exercise>;
  onPreview: (exerciseId: string, exerciseIds: string[], label: string) => void;
  sessions: WorkoutSession[];
  onUpdate: (session: WorkoutSession) => void;
}) {
  const completed = sessions.length;
  const avgPain =
    sessions.filter((item) => typeof item.painAfter === "number").reduce((sum, item) => sum + (item.painAfter ?? 0), 0) /
    Math.max(1, sessions.filter((item) => typeof item.painAfter === "number").length);
  const painfulExercises = sessions.flatMap((session) =>
    session.exerciseLog.filter((item) => item.status === "painful"),
  ).length;

  return (
    <section className="history-grid">
      <div className="history-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h2>History</h2>
        </div>
        <span>{sessions.length ? "Recent sessions" : "No sessions yet"}</span>
      </div>
      <div className="metric">
        <span>Logged sessions</span>
        <strong>{completed}</strong>
      </div>
      <div className="metric">
        <span>Average pain after</span>
        <strong>{avgPain.toFixed(1)}/10</strong>
      </div>
      <div className="metric">
        <span>Painful stops</span>
        <strong>{painfulExercises}</strong>
      </div>
      <div className="history-list">
        {sessions.length === 0 ? (
          <p>No sessions logged yet.</p>
        ) : (
          sessions.map((session) => {
            const sessionExerciseIds = session.exerciseLog.map((item) => item.exerciseId);
            return (
              <article className="session-card" key={session.id}>
                <div>
                  <strong>{session.workoutDate}</strong>
                  <span>{session.planDay} - {session.sessionType}</span>
                </div>
                <div>
                  <span>{session.durationMinutes ?? 0} min</span>
                  <span>Pain {session.painBefore ?? 0} to {session.painAfter ?? 0}</span>
                </div>
                <div className="morning-check" aria-label="Next morning status">
                  <span>Next morning</span>
                  <button
                    className={session.worseNextMorning === "no" ? "selected" : ""}
                    onClick={() => onUpdate({ ...session, worseNextMorning: "no" })}
                  >
                    OK
                  </button>
                  <button
                    className={session.worseNextMorning === "yes" ? "selected warn" : ""}
                    onClick={() => onUpdate({ ...session, worseNextMorning: "yes" })}
                  >
                    Worse
                  </button>
                </div>
                <details className="history-details">
                  <summary>View exercises</summary>
                  <div className="history-exercise-list">
                    {session.exerciseLog.map((item, index) => {
                      const exercise = exerciseMap[item.exerciseId];
                      return (
                        <button
                          className={`history-exercise-button ${item.status}`}
                          key={`${session.id}-${item.exerciseId}`}
                          onClick={() => onPreview(item.exerciseId, sessionExerciseIds, `${session.workoutDate} history`)}
                          type="button"
                        >
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{exercise?.name ?? item.exerciseId}</strong>
                          <small>{exerciseStatusLabels[item.status]}</small>
                        </button>
                      );
                    })}
                  </div>
                </details>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function AdminPlan({
  plan,
  onSave,
}: {
  plan: WorkoutPlan;
  onSave: (plan: WorkoutPlan) => void;
}) {
  const [draft, setDraft] = useState(plan);

  useEffect(() => setDraft(plan), [plan]);

  function updateExercise(id: string, patch: Partial<Exercise>) {
    setDraft({
      ...draft,
      exercises: draft.exercises.map((exercise) =>
        exercise.id === id ? { ...exercise, ...patch } : exercise,
      ),
    });
  }

  function updateDay(dayId: string, type: string) {
    setDraft({
      ...draft,
      days: {
        ...draft.days,
        [dayId]: { ...draft.days[dayId], type },
      },
    });
  }

  return (
    <section className="admin-panel">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Family editor</p>
          <h2>Workout Plan</h2>
          <span>Changes here update the live plan after you save.</span>
        </div>
        <button className="primary-action compact" onClick={() => onSave(draft)}>
          Publish update
        </button>
      </div>

      <div className="admin-section">
        <h3>Weekly labels</h3>
        <div className="day-editor-grid">
          {dayOrder.map((dayId) => (
            <label key={dayId}>
              <span>{draft.days[dayId].label}</span>
              <input
                value={draft.days[dayId].type}
                onChange={(event) => updateDay(dayId, event.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <h3>Exercise videos and doses</h3>
        <div className="exercise-editor-list">
          {draft.exercises.map((exercise) => (
            <article className="exercise-editor" key={exercise.id}>
              <div>
                <strong>{exercise.name}</strong>
                <span>{categoryLabels[exercise.category]}</span>
              </div>
              {videoEmbedUrl(exercise.videoUrl) ? (
                <span className="video-status ready">Video ready</span>
              ) : (
                <span className="video-status">No video</span>
              )}
              <label>
                <span>Dose</span>
                <input
                  value={exercise.dose}
                  onChange={(event) => updateExercise(exercise.id, { dose: event.target.value })}
                />
              </label>
              <label>
                <span>Video URL</span>
                <input
                  value={exercise.videoUrl}
                  placeholder="https://youtube.com/shorts/..."
                  onChange={(event) => updateExercise(exercise.id, { videoUrl: event.target.value })}
                />
              </label>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
