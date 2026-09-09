'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIFFICULTY_LABELS, RUBRIC_DIMENSION_LABELS, type RubricDimension } from '@/lib/constants';

interface FollowUpTemplate {
  trigger: string;
  prompt: string;
  purpose?: string;
}
interface RubricDef {
  dimensions: { name: RubricDimension; maxScore: number; guidance?: string }[];
  passingScore: number;
}
interface QuestionFull {
  id: string;
  questionCode: string;
  category: { name: string };
  competency: { name: string };
  difficulty: number;
  questionType: string;
  scenario?: string | null;
  question: string;
  options: { id: string; label: string; text: string; isCorrect: boolean }[];
  correctAnswer?: unknown;
  expectedAnswer?: string | null;
  strongAnswer?: string | null;
  expertAnswer?: string | null;
  explanation?: string | null;
  reasoning?: string | null;
  commonMistakes?: unknown;
  redFlags?: unknown;
  p6Checks?: unknown;
  followUpQuestions?: unknown;
  scoringRubric?: string | null;
}
interface AQ {
  id: string;
  order: number;
  status: string;
  question: QuestionFull;
  answer: { id: string; finalScore: number | null; interviewerOverrideScore: number | null; writtenAnswerText: string | null; rubricScores: string | null; isCorrect: boolean | null } | null;
}
interface InterviewData {
  id: string;
  position: string;
  projectType: string | null;
  experienceLevel: string | null;
  status: string;
  candidate: { fullName: string; email: string };
  interviewer: { name: string };
  notes: { id: string; note: string; createdAt: string }[];
  followUps: { id: string; prompt: string; response: string | null; score: number | null }[];
  assessment: { id: string; status: string; overallScore: number | null; questions: AQ[] } | null;
}

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function InterviewConsole({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [data, setData] = useState<InterviewData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [overrideScore, setOverrideScore] = useState('');
  const [writtenSummary, setWrittenSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [followUpScore, setFollowUpScore] = useState('');
  const [generalNote, setGeneralNote] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/interviews/${interviewId}`);
    const d = await res.json();
    setData(d.interview);
    if (!selectedId && d.interview?.assessment?.questions?.length) {
      setSelectedId(d.interview.assessment.questions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  useEffect(() => {
    load();
  }, [load]);

  const aq = data?.assessment?.questions.find((q) => q.id === selectedId) ?? null;

  useEffect(() => {
    setShowAnswerKey(false);
    setRubricScores({});
    setOverrideScore(aq?.answer?.interviewerOverrideScore != null ? String(aq.answer.interviewerOverrideScore) : '');
    setWrittenSummary(aq?.answer?.writtenAnswerText ?? '');
  }, [selectedId, aq?.answer]);

  async function saveScore() {
    if (!aq) return;
    await fetch(`/api/interviews/${interviewId}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentQuestionId: aq.id,
        writtenAnswerText: writtenSummary,
        rubricScores: Object.keys(rubricScores).length ? rubricScores : undefined,
        overrideScore: overrideScore ? Number(overrideScore) : undefined,
        notes,
      }),
    });
    setNotes('');
    load();
  }

  async function skip() {
    if (!aq) return;
    await fetch(`/api/interviews/${interviewId}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentQuestionId: aq.id, overrideScore: 0, notes: 'Skipped by interviewer.' }),
    });
    load();
  }

  async function logFollowUp() {
    if (!followUpPrompt) return;
    await fetch(`/api/interviews/${interviewId}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentQuestionId: aq?.id, prompt: followUpPrompt, response: followUpResponse, score: followUpScore ? Number(followUpScore) : undefined }),
    });
    setFollowUpPrompt('');
    setFollowUpResponse('');
    setFollowUpScore('');
    load();
  }

  async function addGeneralNote() {
    if (!generalNote) return;
    await fetch(`/api/interviews/${interviewId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: generalNote }),
    });
    setGeneralNote('');
    load();
  }

  async function completeInterview() {
    await fetch(`/api/interviews/${interviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    if (data?.assessment) router.push(`/assessments/${data.assessment.id}`);
  }

  if (!data) return <div className="p-8 text-center text-ink-400">Loading interview…</div>;

  const rubric = parseJson<RubricDef | null>(aq?.question.scoringRubric, null);
  const followUpTemplates = parseJson<FollowUpTemplate[]>(aq?.question.followUpQuestions as string | undefined, []);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-3 space-y-3">
        <div className="card p-4">
          <div className="text-sm font-semibold text-ink-900">{data.candidate.fullName}</div>
          <div className="text-xs text-ink-500">
            {data.position} {data.projectType ? `· ${data.projectType}` : ''}
          </div>
          <div className="mt-1 text-xs text-ink-400">Interviewer: {data.interviewer.name}</div>
          <span className="badge mt-2 bg-ink-100 text-ink-600">{data.status.replace('_', ' ')}</span>
          {data.status !== 'COMPLETED' && (
            <button className="btn-primary mt-3 w-full text-xs" onClick={completeInterview}>
              Complete Interview
            </button>
          )}
        </div>
        <div className="card max-h-[60vh] overflow-y-auto p-2">
          {data.assessment?.questions.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedId(q.id)}
              className={`mb-1 block w-full rounded-lg p-2 text-start text-xs ${selectedId === q.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  Q{q.order + 1}. {q.question.questionCode}
                </span>
                <StatusDot status={q.status} scored={q.answer != null} />
              </div>
              <div className="text-ink-400">
                {q.question.competency.name} · {DIFFICULTY_LABELS[q.question.difficulty]}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-6 space-y-4">
        {aq && (
          <div className="card p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="badge bg-brand-50 text-brand-700">{aq.question.competency.name}</span>
              <span className="badge bg-ink-100 text-ink-600">{aq.question.category.name}</span>
              <span className="badge bg-amber-100 text-amber-700">{DIFFICULTY_LABELS[aq.question.difficulty]}</span>
              <span className="badge bg-ink-100 text-ink-500">{aq.question.questionType.replace(/_/g, ' ')}</span>
            </div>
            {aq.question.scenario && <p className="mb-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{aq.question.scenario}</p>}
            <p className="mb-4 text-base font-medium text-ink-900">{aq.question.question}</p>

            {aq.question.options.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {aq.question.options.map((o) => (
                  <div key={o.id} className={`rounded-lg border p-2 text-sm ${showAnswerKey && o.isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-ink-200'}`}>
                    <b className="me-1">{o.label}.</b> {o.text}
                  </div>
                ))}
              </div>
            )}

            <button className="btn-ghost mb-3 text-xs" onClick={() => setShowAnswerKey((v) => !v)}>
              {showAnswerKey ? 'Hide' : 'Show'} Answer Key &amp; Rubric
            </button>

            {showAnswerKey && (
              <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                {aq.question.expectedAnswer && <AnswerField label="Expected (Competent)" text={aq.question.expectedAnswer} />}
                {aq.question.strongAnswer && <AnswerField label="Strong" text={aq.question.strongAnswer} />}
                {aq.question.expertAnswer && <AnswerField label="Expert" text={aq.question.expertAnswer} />}
                {aq.question.explanation && <AnswerField label="Explanation" text={aq.question.explanation} />}
                {aq.question.reasoning && <AnswerField label="Reasoning" text={aq.question.reasoning} />}
              </div>
            )}

            <div className="mb-4">
              <label className="label">Candidate&apos;s Answer (interviewer summary)</label>
              <textarea className="input min-h-[90px]" value={writtenSummary} onChange={(e) => setWrittenSummary(e.target.value)} placeholder="Summarize what the candidate said…" />
            </div>

            {rubric ? (
              <div className="mb-4 space-y-2">
                {rubric.dimensions.map((d) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="w-40 text-xs text-ink-600">{RUBRIC_DIMENSION_LABELS[d.name]}</span>
                    <input
                      type="range"
                      min={0}
                      max={d.maxScore}
                      value={rubricScores[d.name] ?? 0}
                      onChange={(e) => setRubricScores((prev) => ({ ...prev, [d.name]: Number(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="w-6 text-end text-xs font-semibold">{rubricScores[d.name] ?? 0}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4">
                <label className="label">Score Override (0-100)</label>
                <input className="input" type="number" min={0} max={100} value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} />
              </div>
            )}

            <div className="mb-4">
              <label className="label">Note for this question</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note…" />
            </div>

            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveScore}>
                Save Score
              </button>
              <button className="btn-secondary" onClick={skip}>
                Skip
              </button>
            </div>
          </div>
        )}

        {aq && followUpTemplates.length > 0 && (
          <div className="card p-5">
            <h3 className="mb-2 text-sm font-semibold text-ink-700">Suggested Follow-ups</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {followUpTemplates.map((f, i) => (
                <button key={i} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:border-brand-400" onClick={() => setFollowUpPrompt(f.prompt)}>
                  {f.prompt}
                </button>
              ))}
            </div>
            <input className="input mb-2" placeholder="Follow-up question asked" value={followUpPrompt} onChange={(e) => setFollowUpPrompt(e.target.value)} />
            <textarea className="input mb-2 min-h-[70px]" placeholder="Candidate's response" value={followUpResponse} onChange={(e) => setFollowUpResponse(e.target.value)} />
            <div className="flex items-center gap-2">
              <input className="input w-24" type="number" min={0} max={100} placeholder="Score" value={followUpScore} onChange={(e) => setFollowUpScore(e.target.value)} />
              <button className="btn-secondary" onClick={logFollowUp}>
                Log Follow-up
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="col-span-3 space-y-4">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-700">Interview Notes</h3>
          <div className="mb-2 max-h-40 space-y-2 overflow-y-auto text-xs">
            {data.notes.map((n) => (
              <div key={n.id} className="rounded bg-ink-50 p-2">
                {n.note}
              </div>
            ))}
          </div>
          <textarea className="input min-h-[60px] text-xs" placeholder="Add a general note…" value={generalNote} onChange={(e) => setGeneralNote(e.target.value)} />
          <button className="btn-secondary mt-2 w-full text-xs" onClick={addGeneralNote}>
            Add Note
          </button>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-700">Follow-up Log</h3>
          <div className="max-h-60 space-y-2 overflow-y-auto text-xs">
            {data.followUps.map((f) => (
              <div key={f.id} className="rounded bg-ink-50 p-2">
                <div className="font-medium">{f.prompt}</div>
                {f.response && <div className="text-ink-500">{f.response}</div>}
                {f.score != null && <div className="text-brand-600">Score: {f.score}</div>}
              </div>
            ))}
            {data.followUps.length === 0 && <div className="text-ink-400">No follow-ups logged yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-amber-700">{label}</div>
      <div className="text-ink-700">{text}</div>
    </div>
  );
}

function StatusDot({ status, scored }: { status: string; scored: boolean }) {
  const color = scored ? 'bg-emerald-500' : status === 'SKIPPED' ? 'bg-ink-300' : 'bg-amber-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}
