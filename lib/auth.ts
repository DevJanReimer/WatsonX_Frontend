import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SESSION_COOKIE = "isdp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): Uint8Array {
  const raw = process.env.APP_SESSION_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "APP_SESSION_SECRET is missing or too short (min 16 chars). Set it in your environment."
    );
  }
  return new TextEncoder().encode(raw);
}

export interface SessionPayload extends JWTPayload {
  sub: string;
}

export async function createSessionToken(username: string): Promise<string> {
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(username)
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_TTL_SECONDS,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/"
  }
};

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.APP_USERNAME;
  const expectedPass = process.env.APP_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  // Constant-time-ish compare for demo purposes
  if (username.length !== expectedUser.length) return false;
  if (password.length !== expectedPass.length) return false;
  let diff = 0;
  for (let i = 0; i < username.length; i++)
    diff |= username.charCodeAt(i) ^ expectedUser.charCodeAt(i);
  for (let i = 0; i < password.length; i++)
    diff |= password.charCodeAt(i) ^ expectedPass.charCodeAt(i);
  return diff === 0;
}
