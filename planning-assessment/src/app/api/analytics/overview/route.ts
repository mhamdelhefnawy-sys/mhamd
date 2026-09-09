import { NextResponse } from 'next/server';
import { requireSession, apiError } from '@/lib/auth/guards';
import { computeAnalyticsOverview } from '@/lib/engine/analytics';

export async function GET() {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'VIEWER']);
    const data = await computeAnalyticsOverview();
    return NextResponse.json(data);
  } catch (err) {
    return apiError(err);
  }
}
