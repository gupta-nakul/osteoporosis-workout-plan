import { createSessionCookie, verifyLogin } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: string; password?: string };
    const user = await verifyLogin(payload.email ?? "", payload.password ?? "");
    if (!user) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    return Response.json(
      { user },
      {
        headers: {
          "set-cookie": await createSessionCookie(user, request),
        },
      },
    );
  } catch {
    return Response.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
