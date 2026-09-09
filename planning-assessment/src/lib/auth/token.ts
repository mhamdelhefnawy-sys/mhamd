import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@/lib/constants';

export const SESSION_COOKIE_NAME = 'pe_session';
export const SESSION_DURATION_SEC = 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  candidateId?: string;
}

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not set. Copy .env.example to .env and set a long random value.');
  }
  return new TextEncoder().encode(secret);
}

/** Pure JWT helpers — safe to import from Edge Middleware (no next/headers). */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
