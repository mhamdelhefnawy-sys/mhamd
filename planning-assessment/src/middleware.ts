import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/token';
import type { Role } from '@/lib/constants';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

/** Route-prefix → roles allowed. Missing prefix = any authenticated user. */
const ROLE_GATED_PREFIXES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/api/admin', roles: ['ADMIN'] },
  { prefix: '/question-bank', roles: ['ADMIN', 'ASSESSMENT_MANAGER'] },
  { prefix: '/api/questions/manage', roles: ['ADMIN', 'ASSESSMENT_MANAGER'] },
  { prefix: '/interview', roles: ['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER'] },
  { prefix: '/analytics', roles: ['ADMIN', 'ASSESSMENT_MANAGER', 'VIEWER'] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/reports/') // pdf streaming route checks auth itself
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const gate = ROLE_GATED_PREFIXES.find((g) => pathname.startsWith(g.prefix));
  if (gate && !gate.roles.includes(session.role)) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)'],
};
