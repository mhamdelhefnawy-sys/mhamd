import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { hashPassword } from '@/lib/auth/password';
import { ROLES } from '@/lib/constants';

export async function GET() {
  try {
    await requireSession(['ADMIN']);
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, isActive: true, locale: true, createdAt: true } });
    return NextResponse.json({ users });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession(['ADMIN']);
    const body = await req.json();
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });

    const passwordHash = await hashPassword(body.password || 'Passw0rd!123');
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email.toLowerCase(), role: body.role, passwordHash, locale: body.locale ?? 'en' },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
