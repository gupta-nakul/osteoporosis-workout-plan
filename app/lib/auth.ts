import { env } from "cloudflare:workers";

export type AuthRole = "admin" | "viewer";

export type AuthUser = {
  email: string;
  role: AuthRole;
};

type StoredUser = AuthUser & {
  salt: string;
  hash: string;
};

const cookieName = "care_session";
const encoder = new TextEncoder();

function getEnvValue(key: string) {
  return (env as unknown as Record<string, string | undefined>)[key] ?? "";
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array | string) {
  const source =
    typeof bytes === "string"
      ? encoder.encode(bytes)
      : bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);
  let binary = "";
  source.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getEnvValue("SESSION_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64UrlEncode(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function timingSafeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

async function hashPassword(password: string, salt: string) {
  return base64UrlEncode(await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${password}`)));
}

function readUsers(): StoredUser[] {
  const raw = getEnvValue("AUTH_USERS");
  if (!raw) return [];
  return JSON.parse(raw) as StoredUser[];
}

function cookieFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = readUsers().find((candidate) => candidate.email === normalizedEmail);
  if (!user) return null;

  const hash = await hashPassword(password, user.salt);
  if (!timingSafeEqual(hash, user.hash)) return null;
  return { email: user.email, role: user.role };
}

export async function createSessionCookie(user: AuthUser, request: Request) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60;
  const payload = base64UrlEncode(JSON.stringify({ ...user, exp: expiresAt }));
  const signature = await hmac(payload);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${payload}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 60}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  const token = cookieFromRequest(request);
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expectedSignature = await hmac(payload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as AuthUser & { exp: number };
  if (!decoded.email || !decoded.role || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { email: decoded.email, role: decoded.role };
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return { user: null, response: Response.json({ error: "Sign in required." }, { status: 401 }) };
  }
  return { user, response: null };
}

export function isAdmin(user: AuthUser) {
  return user.role === "admin";
}
