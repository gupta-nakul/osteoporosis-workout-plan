import { requireUser } from "../../lib/auth";
import { listSessions, saveSession } from "../../lib/d1";
import type { WorkoutSession } from "../../lib/workout-data";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const sessions = await listSessions();
    return Response.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load sessions";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const payload = (await request.json()) as { session?: WorkoutSession };
    if (!payload.session?.id || !payload.session.workoutDate) {
      return Response.json({ error: "A complete session is required." }, { status: 400 });
    }

    await saveSession(payload.session);
    const sessions = await listSessions();
    return Response.json({ sessions }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save session";
    return Response.json({ error: message }, { status: 500 });
  }
}
