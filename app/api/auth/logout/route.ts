import { clearSessionCookie } from "../../../lib/auth";

export async function POST(request: Request) {
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": clearSessionCookie(request),
      },
    },
  );
}
