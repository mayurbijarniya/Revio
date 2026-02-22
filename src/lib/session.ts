import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload, PublicUser } from "@/types/auth";
import { env, requireEnv } from "@/lib/env";

const SESSION_COOKIE_NAME = "revio_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

function getSessionSecret(): Uint8Array {
  const secret = requireEnv("SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT session token
 */
export async function createSession(user: PublicUser): Promise<string> {
  const payload: Omit<SessionPayload, "iat" | "exp"> = {
    userId: user.id,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    email: user.email,
    avatarUrl: user.avatarUrl,
    plan: user.plan,
  };

  const token = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSessionSecret());

  return token;
}

/**
 * Verify and decode a session token
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Get the session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySession(token);
}

/**
 * Delete the session cookie
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId ?? null;
}
