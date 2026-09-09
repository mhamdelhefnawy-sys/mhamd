import type { Role } from '@/lib/constants';

/**
 * §41 — a Candidate must never receive the answer key, scoring rubric,
 * hidden follow-up questions, expert/strong answer text, or common-mistake
 * / red-flag hints while an assessment is in progress. This is the single
 * server-side choke point: every API route that sends a question to a
 * candidate must pass it through here before it leaves the server — never
 * rely on the UI simply not rendering the field.
 */
const CANDIDATE_HIDDEN_FIELDS = [
  'correctAnswer',
  'expectedAnswer',
  'strongAnswer',
  'expertAnswer',
  'explanation',
  'reasoning',
  'commonMistakes',
  'redFlags',
  'p6Checks',
  'followUpQuestions',
  'scoringRubric',
  'acceptableAlternativeAnswers',
] as const;

export function sanitizeQuestionForRole<T extends Record<string, unknown>>(question: T, role: Role, revealAnswers = false): T {
  if (role === 'ADMIN' || role === 'ASSESSMENT_MANAGER' || role === 'INTERVIEWER' || revealAnswers) {
    return question;
  }
  const clone: Record<string, unknown> = { ...question };
  if (Array.isArray(clone.options)) {
    clone.options = (clone.options as Array<Record<string, unknown>>).map(({ isCorrect, ...rest }) => rest);
  }
  for (const f of CANDIDATE_HIDDEN_FIELDS) delete clone[f];
  return clone as T;
}
