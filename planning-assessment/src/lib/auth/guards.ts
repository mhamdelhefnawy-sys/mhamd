import { NextResponse } from 'next/server';
import { getSession, type SessionPayload } from './session';
import type { Role } from '@/lib/constants';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Throws AuthError if not authenticated, or (when roles given) not authorized. */
export async function requireSession(roles?: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError('Authentication required.', 401);
  if (roles && !roles.includes(session.role)) {
    throw new AuthError('You do not have permission to perform this action.', 403);
  }
  return session;
}

export function apiError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  // eslint-disable-next-line no-console
  console.error(err);
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Role capability matrix (§41). Candidates never see answer keys, rubrics,
 * hidden follow-ups, admin analytics, or other candidates' data — enforced
 * both by hiding UI (convenience only) and by stripping fields server-side
 * in src/lib/engine/sanitize.ts, never by trusting the client.
 */
export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  ADMIN: ['*'],
  ASSESSMENT_MANAGER: [
    'assessments:create',
    'assessments:read',
    'candidates:manage',
    'reports:read',
    'analytics:read',
    'questions:read',
  ],
  INTERVIEWER: ['interviews:conduct', 'assessments:read', 'candidates:read', 'reports:read', 'questions:read'],
  CANDIDATE: ['assessments:take-own', 'reports:read-own'],
  VIEWER: ['candidates:read', 'reports:read', 'analytics:read', 'questions:read'],
};

export function can(role: Role, capability: string): boolean {
  const caps = ROLE_CAPABILITIES[role] ?? [];
  return caps.includes('*') || caps.includes(capability);
}
