import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { InterviewConsole } from '@/components/InterviewConsole';

export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: { id: string } }) {
  const interview = await prisma.interview.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!interview) notFound();
  return <InterviewConsole interviewId={interview.id} />;
}
