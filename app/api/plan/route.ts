import { isAdmin, requireUser } from "../../lib/auth";
import { readPlan, savePlan } from "../../lib/d1";
import type { WorkoutPlan } from "../../lib/workout-data";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const plan = await readPlan();
    return Response.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load plan";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    if (!isAdmin(auth.user)) {
      return Response.json({ error: "Only the family admin can edit the workout plan." }, { status: 403 });
    }

    const payload = (await request.json()) as { plan?: WorkoutPlan };
    if (!payload.plan?.patientTimezone || !payload.plan.exercises?.length) {
      return Response.json({ error: "A complete workout plan is required." }, { status: 400 });
    }

    await savePlan(payload.plan);
    const plan = await readPlan();
    return Response.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save plan";
    return Response.json({ error: message }, { status: 500 });
  }
}
