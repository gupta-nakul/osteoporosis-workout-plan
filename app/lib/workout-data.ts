export type Exercise = {
  id: string;
  name: string;
  category: "warmup" | "strength" | "balance" | "posture" | "walking";
  dose: string;
  equipment: string;
  videoUrl: string;
  cues: string[];
  stopRules: string[];
  timer?: {
    sets: number;
    workSeconds?: number;
    restSeconds?: number;
    workLabel?: string;
  };
};

export type WorkoutDay = {
  id: string;
  label: string;
  type: string;
  estimate: string;
  exerciseIds: string[];
};

export type WorkoutPlan = {
  patientName: string;
  patientTimezone: "Asia/Kolkata";
  updatedAt: string;
  safetyRules: string[];
  urgentRules: string[];
  days: Record<string, WorkoutDay>;
  exercises: Exercise[];
};

export type ExerciseLog = {
  exerciseId: string;
  status: "completed" | "skipped" | "painful";
  painDuring?: number;
  skipReason?: string;
  completedAtUtc: string;
};

export type WorkoutSession = {
  id: string;
  workoutDate: string;
  planDay: string;
  sessionType: string;
  startedAtUtc: string;
  startedAtLocal: string;
  endedAtUtc?: string;
  durationMinutes?: number;
  painBefore?: number;
  painAfter?: number;
  worseNextMorning?: "yes" | "no" | "unknown";
  exerciseLog: ExerciseLog[];
  notes?: string;
};

export const reviewedVideoCue =
  "Add a reviewed YouTube Short, unlisted family demo, or physio-approved clip.";

export const defaultPlan: WorkoutPlan = {
  patientName: "Patient",
  patientTimezone: "Asia/Kolkata",
  updatedAt: new Date().toISOString(),
  safetyRules: [
    "Keep spine neutral.",
    "No loaded forward bending or twisting.",
    "No jerky movements or breath-holding.",
    "Stop if pain spreads down the leg.",
  ],
  urgentRules: [
    "New leg weakness",
    "Numbness, tingling, or pain spreading farther down the leg",
    "Bladder or bowel changes",
    "Severe back pain after a fall",
  ],
  days: {
    monday: {
      id: "monday",
      label: "Monday",
      type: "Workout A - Intermediate",
      estimate: "28-34 min",
      exerciseIds: [
        "marching",
        "shoulder-setting",
        "hinge-wall",
        "sit-to-stand",
        "band-row",
        "hip-abduction",
        "heel-raises",
        "ab-brace",
        "heel-slides",
        "clock-taps",
      ],
    },
    tuesday: {
      id: "tuesday",
      label: "Tuesday",
      type: "Walk + Band Posture",
      estimate: "25-30 min",
      exerciseIds: [
        "easy-walk",
        "shoulder-setting",
        "band-row",
        "hip-abduction",
        "side-steps",
        "wall-posture",
      ],
    },
    wednesday: {
      id: "wednesday",
      label: "Wednesday",
      type: "Workout B - Intermediate",
      estimate: "28-34 min",
      exerciseIds: [
        "marching",
        "shoulder-setting",
        "hinge-wall",
        "wall-pushups",
        "hip-extension",
        "biceps-curl",
        "glute-squeeze",
        "modified-bird-dog",
        "wall-posture",
        "single-leg-stance",
      ],
    },
    thursday: {
      id: "thursday",
      label: "Thursday",
      type: "Walk + Band Balance",
      estimate: "25-30 min",
      exerciseIds: [
        "easy-walk",
        "wall-posture",
        "band-row",
        "hip-extension",
        "single-leg-stance",
        "shoulder-setting",
      ],
    },
    friday: {
      id: "friday",
      label: "Friday",
      type: "Workout A - Intermediate",
      estimate: "28-34 min",
      exerciseIds: [
        "marching",
        "shoulder-setting",
        "hinge-wall",
        "sit-to-stand",
        "band-row",
        "hip-abduction",
        "heel-raises",
        "ab-brace",
        "heel-slides",
        "clock-taps",
      ],
    },
    saturday: {
      id: "saturday",
      label: "Saturday",
      type: "Light Walk + Balance",
      estimate: "18-22 min",
      exerciseIds: [
        "easy-walk",
        "side-steps",
        "single-leg-stance",
        "wall-posture",
        "heel-raises",
      ],
    },
    sunday: {
      id: "sunday",
      label: "Sunday",
      type: "Off",
      estimate: "Rest",
      exerciseIds: [],
    },
  },
  exercises: [
    {
      id: "marching",
      name: "Supported Marching",
      category: "warmup",
      dose: "2 minutes",
      equipment: "Counter or sturdy chair",
      videoUrl: "https://www.youtube.com/watch?v=xom-st-GwW4",
      cues: ["Hold support.", "Lift feet slowly.", "Stay tall."],
      stopRules: ["Stop if heel pain increases.", "Stop if balance feels unsafe."],
      timer: { sets: 1, workSeconds: 120, workLabel: "March" },
    },
    {
      id: "shoulder-setting",
      name: "Shoulder-Blade Setting",
      category: "posture",
      dose: "2 sets x 10 reps",
      equipment: "None",
      videoUrl: "https://www.youtube.com/watch?v=ouRhQE2iOI8",
      cues: ["Sit or stand tall.", "Gently pull shoulder blades back.", "Do not arch the back."],
      stopRules: ["Stop if neck pain increases."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "hinge-wall",
      name: "Hip Hinge To Wall",
      category: "warmup",
      dose: "2 sets x 6-8 reps",
      equipment: "Wall",
      videoUrl: "https://www.youtube.com/watch?v=4VDafFbBSao",
      cues: ["Push hips backward.", "Keep back long.", "Do not round forward."],
      stopRules: ["Stop if back pain sharpens."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "sit-to-stand",
      name: "Chair Sit-To-Stand",
      category: "strength",
      dose: "2 sets x 8-10 reps",
      equipment: "Sturdy chair against wall",
      videoUrl: "https://www.youtube.com/watch?v=ITv-_BkcrD0",
      cues: ["Feet flat.", "Small hip hinge.", "Stand using both legs.", "Sit slowly."],
      stopRules: ["Stop if knee, back, or leg pain rises above 3/10."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "band-row",
      name: "Upright Band Row",
      category: "strength",
      dose: "2 sets x 10-12 reps",
      equipment: "Resistance band",
      videoUrl: "https://www.youtube.com/watch?v=db43OS-4ruY",
      cues: ["Anchor band at chest height.", "Pull elbows backward.", "Do not lean backward."],
      stopRules: ["Stop if back arches or shoulder pain appears."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "hip-abduction",
      name: "Standing Hip Abduction",
      category: "strength",
      dose: "2 sets x 10 each side",
      equipment: "Counter",
      videoUrl: "https://www.youtube.com/watch?v=e7MD61ENyBY",
      cues: ["Toes face forward.", "Move leg sideways.", "Keep torso still."],
      stopRules: ["Stop if pain travels into thigh or leg."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "heel-raises",
      name: "Supported Heel Raises",
      category: "strength",
      dose: "2 sets x 12 reps",
      equipment: "Counter",
      videoUrl: "https://www.youtube.com/watch?v=MW2WG5l-fYE",
      cues: ["Rise slowly.", "Lower slowly.", "Use only comfortable range."],
      stopRules: ["Stop if heel pain increases."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "ab-brace",
      name: "Gentle Abdominal Brace",
      category: "strength",
      dose: "2 sets x 8 holds, 5 seconds each",
      equipment: "Yoga mat",
      videoUrl: "https://www.youtube.com/watch?v=J_2ImNPjxtc",
      cues: ["Lie with knees bent.", "Tighten abdomen gently.", "Keep breathing."],
      stopRules: ["Stop if breath-holding or back pain occurs."],
      timer: { sets: 2, workSeconds: 40, restSeconds: 30, workLabel: "Brace holds" },
    },
    {
      id: "heel-slides",
      name: "Heel Slides",
      category: "strength",
      dose: "2 sets x 6-8 each side",
      equipment: "Yoga mat",
      videoUrl: "https://www.youtube.com/watch?v=rAMPY8lAbfY",
      cues: ["Brace gently.", "Slide heel away.", "Stop before back arches."],
      stopRules: ["Stop if buttock, thigh, or leg symptoms increase."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "clock-taps",
      name: "Supported Clock Taps",
      category: "balance",
      dose: "2 sets x 5 taps each direction",
      equipment: "Counter",
      videoUrl: "",
      cues: ["Hold the counter.", "Stand tall on one leg.", "Tap the other foot forward, side, and back.", "Move slowly."],
      stopRules: ["Stop if balance feels unsafe.", "Stop if hip, back, or leg pain increases."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "side-steps",
      name: "Supported Side Steps",
      category: "balance",
      dose: "2 sets x 10 steps each direction",
      equipment: "Counter or wall",
      videoUrl: "",
      cues: ["Stay tall.", "Step sideways slowly.", "Keep toes forward.", "Use support as needed."],
      stopRules: ["Stop if balance feels unsafe.", "Stop if hip, back, or leg pain increases."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "easy-walk",
      name: "Easy Flat Walk",
      category: "walking",
      dose: "12 minutes",
      equipment: "Supportive shoes",
      videoUrl: "",
      cues: ["Flat surface.", "Easy pace.", "Use the in-app timer.", "Switch to marching if heel pain rises."],
      stopRules: ["Stop if heel pain worsens or leg pain spreads."],
      timer: { sets: 1, workSeconds: 720, workLabel: "Walk" },
    },
    {
      id: "single-leg-stance",
      name: "Supported Single-Leg Stance",
      category: "balance",
      dose: "2 x 20-30 seconds each leg",
      equipment: "Counter",
      videoUrl: "https://www.youtube.com/watch?v=7SF7AYh2_Yw",
      cues: ["Hold counter.", "Lift one foot slightly.", "Stay tall."],
      stopRules: ["Stop if balance feels unsafe."],
      timer: { sets: 2, workSeconds: 30, restSeconds: 30, workLabel: "Balance hold" },
    },
    {
      id: "wall-posture",
      name: "Wall Posture Hold",
      category: "posture",
      dose: "3 x 30-45 seconds",
      equipment: "Wall",
      videoUrl: "https://www.youtube.com/watch?v=5UhS6k8yBDg",
      cues: ["Chin gently back.", "Chest relaxed.", "No forced arch."],
      stopRules: ["Stop if neck or back pain increases."],
      timer: { sets: 3, workSeconds: 45, restSeconds: 30, workLabel: "Posture hold" },
    },
    {
      id: "wall-pushups",
      name: "Wall Push-Ups",
      category: "strength",
      dose: "2 sets x 10-12 reps",
      equipment: "Wall",
      videoUrl: "https://www.youtube.com/watch?v=wIPJvBQs7RA",
      cues: ["Hands at chest height.", "Body in one line.", "Move slowly."],
      stopRules: ["Stop if shoulder, wrist, or back pain appears."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "hip-extension",
      name: "Standing Hip Extension",
      category: "strength",
      dose: "2 sets x 10 each side",
      equipment: "Counter",
      videoUrl: "https://www.youtube.com/watch?v=OaUMKUEoFQ4",
      cues: ["Move leg slightly backward.", "Squeeze buttock.", "Do not arch lower back."],
      stopRules: ["Stop if back or leg symptoms increase."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "biceps-curl",
      name: "Dumbbell Biceps Curls",
      category: "strength",
      dose: "2 sets x 10-12 reps",
      equipment: "1-2 kg dumbbells",
      videoUrl: "https://www.youtube.com/watch?v=cQsU9dbDMo0",
      cues: ["Sit or stand upright.", "Elbows near ribs.", "Do not lean backward."],
      stopRules: ["Stop if back arches or shoulder pain appears."],
      timer: { sets: 2, restSeconds: 30 },
    },
    {
      id: "glute-squeeze",
      name: "Glute Squeeze",
      category: "strength",
      dose: "2 sets x 10 reps, 5-second holds",
      equipment: "Yoga mat",
      videoUrl: "https://www.youtube.com/watch?v=sH-4ZvZlwC8",
      cues: ["Lie with knees bent.", "Tighten both buttocks.", "Do not lift hips yet."],
      stopRules: ["Stop if buttock, thigh, or leg symptoms increase."],
      timer: { sets: 2, workSeconds: 50, restSeconds: 30, workLabel: "Glute holds" },
    },
    {
      id: "modified-bird-dog",
      name: "Modified Bird-Dog",
      category: "strength",
      dose: "2 sets x 6 each side",
      equipment: "Yoga mat",
      videoUrl: "https://www.youtube.com/watch?v=9trxFsQ_tFw",
      cues: ["Hands and knees.", "Slide one arm forward slightly.", "Keep spine neutral."],
      stopRules: ["Do not progress if unstable.", "Stop if pain spreads down the leg."],
      timer: { sets: 2, restSeconds: 30 },
    },
  ].map((exercise) => ({
    ...exercise,
    cues:
      exercise.videoUrl || exercise.id === "easy-walk"
        ? exercise.cues
        : [...exercise.cues, reviewedVideoCue],
  })),
};
