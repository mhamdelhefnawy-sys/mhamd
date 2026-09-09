'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIFFICULTY_LABELS } from '@/lib/constants';

interface QuestionOption {
  id: string;
  label: string;
  text: string;
}
interface QuestionPayload {
  id: string;
  questionCode: string;
  category: { name: string };
  competency: { name: string };
  difficulty: number;
  careerLevel: string;
  questionType: string;
  scenario?: string | null;
  question: string;
  options: QuestionOption[];
  givenData?: string | null;
  projectSituation?: string | null;
}

const CHOICE_TYPES = new Set(['MCQ', 'TRUE_FALSE']);
const OPEN_TEXT_TYPES = new Set([
  'WRITTEN',
  'SCENARIO',
  'TROUBLESHOOTING',
  'CASE_STUDY',
  'P6_ANALYSIS',
  'INTERVIEW',
  'DECISION_MAKING',
  'WHAT_CHECK_FIRST',
  'IS_THIS_POSSIBLE',
  'MOST_LIKELY_CAUSE',
  'WHAT_NEXT',
  'MISSING_INFO',
  'PARADOX',
  'PRACTICAL_SCENARIO',
  'DELAY_CLAIM_SCENARIO',
  'MANAGEMENT_SCENARIO',
]);

export function AssessmentRunner({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [assessmentQuestionId, setAssessmentQuestionId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });
  const [trainingMode, setTrainingMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [numericAnswer, setNumericAnswer] = useState('');
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setSelected([]);
    setNumericAnswer('');
    setWrittenAnswer('');
    const res = await fetch(`/api/assessments/${assessmentId}/current`);
    const data = await res.json();
    setProgress(data.progress ?? { answered: 0, total: 0 });
    if (data.done) {
      router.push(`/assessments/${assessmentId}`);
      return;
    }
    setQuestion(data.question);
    setAssessmentQuestionId(data.assessmentQuestionId);
    setTrainingMode(!!data.trainingMode);
    startedAt.current = Date.now();
    setLoading(false);
  }, [assessmentId, router]);

  useEffect(() => {
    loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  async function submitAnswer() {
    if (!question || !assessmentQuestionId) return;
    setSubmitting(true);
    const timeSpentSec = Math.round((Date.now() - startedAt.current) / 1000);
    let candidateAnswer: unknown = null;
    if (CHOICE_TYPES.has(question.questionType)) candidateAnswer = selected[0] ?? null;
    else if (question.questionType === 'MULTI_SELECT') candidateAnswer = selected;
    else if (question.questionType === 'NUMERICAL') candidateAnswer = numericAnswer ? Number(numericAnswer) : null;

    const res = await fetch(`/api/assessments/${assessmentId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentQuestionId, candidateAnswer, writtenAnswerText: writtenAnswer, timeSpentSec }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (data.feedback) {
      setFeedback(data.feedback);
      return; // wait for "Next" click so the candidate can read the explanation
    }
    if (data.done) {
      router.push(`/assessments/${assessmentId}`);
      return;
    }
    loadCurrent();
  }

  if (loading) return <div className="card p-8 text-center text-ink-400">Loading question…</div>;
  if (!question) return null;

  const pct = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
          <span>
            Question {progress.answered + 1} of {progress.total || '…'}
          </span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="badge bg-brand-50 text-brand-700">{question.competency.name}</span>
          <span className="badge bg-ink-100 text-ink-600">{question.category.name}</span>
          <span className="badge bg-amber-100 text-amber-700">{DIFFICULTY_LABELS[question.difficulty]}</span>
          <span className="badge bg-ink-100 text-ink-500">{question.questionType.replace(/_/g, ' ')}</span>
        </div>

        {question.scenario && <p className="mb-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{question.scenario}</p>}
        <p className="mb-4 text-base font-medium text-ink-900">{question.question}</p>

        {!feedback && (
          <>
            {CHOICE_TYPES.has(question.questionType) &&
              question.options.map((opt) => (
                <label key={opt.id} className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selected[0] === opt.label ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input type="radio" name="opt" className="mt-0.5" checked={selected[0] === opt.label} onChange={() => setSelected([opt.label])} />
                  <span>
                    <b className="me-1">{opt.label}.</b> {opt.text}
                  </span>
                </label>
              ))}

            {question.questionType === 'MULTI_SELECT' &&
              question.options.map((opt) => (
                <label key={opt.id} className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${selected.includes(opt.label) ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes(opt.label)}
                    onChange={() => setSelected((prev) => (prev.includes(opt.label) ? prev.filter((v) => v !== opt.label) : [...prev, opt.label]))}
                  />
                  <span>
                    <b className="me-1">{opt.label}.</b> {opt.text}
                  </span>
                </label>
              ))}

            {question.questionType === 'NUMERICAL' && (
              <input className="input" type="number" step="any" placeholder="Enter numeric answer" value={numericAnswer} onChange={(e) => setNumericAnswer(e.target.value)} />
            )}

            {OPEN_TEXT_TYPES.has(question.questionType) && (
              <textarea
                className="input min-h-[140px]"
                placeholder="Write your answer — explain your reasoning, not just a conclusion."
                value={writtenAnswer}
                onChange={(e) => setWrittenAnswer(e.target.value)}
              />
            )}

            <div className="mt-5 flex justify-end">
              <button className="btn-primary" disabled={submitting} onClick={submitAnswer}>
                {submitting ? 'Submitting…' : 'Submit Answer'}
              </button>
            </div>
          </>
        )}

        {feedback && (
          <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              {typeof feedback.isCorrect === 'boolean' ? (
                <span className={feedback.isCorrect ? 'text-emerald-700' : 'text-red-700'}>{feedback.isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
              ) : (
                <span className="text-brand-700">Indicative score: {Math.round(Number(feedback.score ?? 0))}%</span>
              )}
            </div>
            {!!feedback.explanation && (
              <div>
                <div className="text-xs font-semibold uppercase text-ink-500">Explanation</div>
                <p className="text-ink-700">{String(feedback.explanation)}</p>
              </div>
            )}
            {!!feedback.reasoning && (
              <div>
                <div className="text-xs font-semibold uppercase text-ink-500">Reasoning</div>
                <p className="text-ink-700">{String(feedback.reasoning)}</p>
              </div>
            )}
            {Array.isArray(feedback.commonMistakes) && feedback.commonMistakes.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase text-ink-500">Common Mistakes</div>
                <ul className="list-inside list-disc text-ink-700">
                  {(feedback.commonMistakes as string[]).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={loadCurrent}>
                Next Question →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
