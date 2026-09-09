import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN']);
    const body = await req.json();
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: body.isActive, role: body.role },
    });
    return NextResponse.json({ user });
  } catch (err) {
    return apiError(err);
  }
}
