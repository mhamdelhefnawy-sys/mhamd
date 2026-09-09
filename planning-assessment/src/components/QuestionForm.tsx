'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CATEGORIES,
  CAREER_LEVELS,
  CAREER_LEVEL_LABELS,
  COMPETENCY_GROUPS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  QUESTION_STATUSES,
  QUESTION_TYPES,
  RUBRIC_DIMENSIONS,
  RUBRIC_DIMENSION_LABELS,
  AUTO_SCORED_TYPES,
} from '@/lib/constants';

interface OptionRow {
  label: string;
  text: string;
  isCorrect: boolean;
}
interface FollowUpRow {
  trigger: string;
  prompt: string;
  purpose: string;
}
interface RubricRow {
  name: string;
  maxScore: number;
  guidance: string;
}

const linesToArray = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const arrayToLines = (a?: unknown) => (Array.isArray(a) ? a.join('\n') : '');

export function QuestionForm({ initial }: { initial?: Record<string, unknown> }) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  const [questionCode, setQuestionCode] = useState((initial?.questionCode as string) ?? '');
  const [categoryCode, setCategoryCode] = useState(((initial?.category as { code: string })?.code) ?? CATEGORIES[0].code);
  const [subcategory, setSubcategory] = useState((initial?.subcategory as string) ?? '');
  const [competencyCode, setCompetencyCode] = useState(((initial?.competency as { code: string })?.code) ?? COMPETENCY_GROUPS[0].code);
  const [skill, setSkill] = useState((initial?.skill as string) ?? '');
  const [difficulty, setDifficulty] = useState((initial?.difficulty as number) ?? 3);
  const [careerLevel, setCareerLevel] = useState((initial?.careerLevel as string) ?? 'PLANNING_ENGINEER');
  const [questionType, setQuestionType] = useState((initial?.questionType as string) ?? 'SCENARIO');
  const [status, setStatus] = useState((initial?.status as string) ?? 'DRAFT');
  const [weight, setWeight] = useState((initial?.weight as number) ?? 1);
  const [estimatedTimeSec, setEstimatedTimeSec] = useState((initial?.estimatedTimeSec as number) ?? 120);
  const [tags, setTags] = useState(((initial?.tags as string[]) ?? []).join(', '));

  const [scenario, setScenario] = useState((initial?.scenario as string) ?? '');
  const [question, setQuestion] = useState((initial?.question as string) ?? '');

  const [options, setOptions] = useState<OptionRow[]>(
    (initial?.options as OptionRow[])?.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })) ?? [
      { label: 'A', text: '', isCorrect: true },
      { label: 'B', text: '', isCorrect: false },
      { label: 'C', text: '', isCorrect: false },
      { label: 'D', text: '', isCorrect: false },
    ],
  );
  const [numericAnswer, setNumericAnswer] = useState(typeof initial?.correctAnswer === 'number' ? String(initial.correctAnswer) : '');

  const [expectedAnswer, setExpectedAnswer] = useState((initial?.expectedAnswer as string) ?? '');
  const [strongAnswer, setStrongAnswer] = useState((initial?.strongAnswer as string) ?? '');
  const [expertAnswer, setExpertAnswer] = useState((initial?.expertAnswer as string) ?? '');
  const [explanation, setExplanation] = useState((initial?.explanation as string) ?? '');
  const [reasoning, setReasoning] = useState((initial?.reasoning as string) ?? '');
  const [commonMistakes, setCommonMistakes] = useState(arrayToLines(initial?.commonMistakes));
  const [redFlags, setRedFlags] = useState(arrayToLines(initial?.redFlags));
  const [p6Checks, setP6Checks] = useState(arrayToLines(initial?.p6Checks));
  const [references, setReferences] = useState(arrayToLines(initial?.references));

  const [followUps, setFollowUps] = useState<FollowUpRow[]>(
    ((initial?.followUpQuestions as FollowUpRow[]) ?? []).map((f) => ({ trigger: f.trigger, prompt: f.prompt, purpose: f.purpose ?? '' })),
  );
  const [rubricRows, setRubricRows] = useState<RubricRow[]>(
    ((initial?.scoringRubric as { dimensions: RubricRow[] })?.dimensions ?? []).map((d) => ({ name: d.name, maxScore: d.maxScore, guidance: d.guidance ?? '' })),
  );
  const [passingScore, setPassingScore] = useState(((initial?.scoringRubric as { passingScore: number })?.passingScore) ?? 6);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsOptions = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE'].includes(questionType);
  const needsNumeric = questionType === 'NUMERICAL';
  const needsRubric = !AUTO_SCORED_TYPES.includes(questionType as (typeof AUTO_SCORED_TYPES)[number]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let correctAnswer: unknown = undefined;
    if (needsOptions) {
      const correctLabels = options.filter((o) => o.isCorrect).map((o) => o.label);
      correctAnswer = questionType === 'MULTI_SELECT' ? correctLabels : correctLabels[0];
    } else if (needsNumeric) {
      correctAnswer = numericAnswer ? Number(numericAnswer) : undefined;
    }

    const payload = {
      questionCode,
      categoryCode,
      subcategory,
      competencyCode,
      skill,
      difficulty,
      careerLevel,
      questionType,
      status,
      weight,
      estimatedTimeSec,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      scenario: scenario || undefined,
      question,
      options: needsOptions ? options.filter((o) => o.text) : undefined,
      correctAnswer,
      expectedAnswer: expectedAnswer || undefined,
      strongAnswer: strongAnswer || undefined,
      expertAnswer: expertAnswer || undefined,
      explanation: explanation || undefined,
      reasoning: reasoning || undefined,
      commonMistakes: linesToArray(commonMistakes),
      redFlags: linesToArray(redFlags),
      p6Checks: linesToArray(p6Checks),
      references: linesToArray(references),
      followUpQuestions: followUps.filter((f) => f.prompt),
      scoringRubric: needsRubric && rubricRows.length ? { dimensions: rubricRows, passingScore } : undefined,
    };

    const res = await fetch(isEdit ? `/api/questions/${initial!.id}` : '/api/questions', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to save question.');
      return;
    }
    router.push('/question-bank');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Classification">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Question Code">
            <input className="input" required value={questionCode} onChange={(e) => setQuestionCode(e.target.value)} placeholder="e.g. CPM-046" />
          </Field>
          <Field label="Category">
            <select className="input" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subcategory">
            <input className="input" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
          </Field>
          <Field label="Competency Group">
            <select className="input" value={competencyCode} onChange={(e) => setCompetencyCode(e.target.value)}>
              {COMPETENCY_GROUPS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Skill">
            <input className="input" value={skill} onChange={(e) => setSkill(e.target.value)} />
          </Field>
          <Field label="Difficulty">
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d} value={d}>
                  L{d} — {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Career Level">
            <select className="input" value={careerLevel} onChange={(e) => setCareerLevel(e.target.value)}>
              {CAREER_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {CAREER_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Question Type">
            <select className="input" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {QUESTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Weight">
            <input className="input" type="number" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </Field>
          <Field label="Estimated Time (sec)">
            <input className="input" type="number" value={estimatedTimeSec} onChange={(e) => setEstimatedTimeSec(Number(e.target.value))} />
          </Field>
          <Field label="Tags (comma separated)">
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Content">
        <Field label="Scenario (optional context)">
          <textarea className="input min-h-[80px]" value={scenario} onChange={(e) => setScenario(e.target.value)} />
        </Field>
        <Field label="Question">
          <textarea className="input min-h-[80px]" required value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
      </Section>

      {needsOptions && (
        <Section title="Options">
          {options.map((o, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input
                className="input w-14"
                value={o.label}
                onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))}
              />
              <input
                className="input flex-1"
                placeholder="Option text"
                value={o.text}
                onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, text: e.target.value } : p)))}
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type={questionType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                  name="correctOpt"
                  checked={o.isCorrect}
                  onChange={() =>
                    setOptions((prev) =>
                      prev.map((p, j) => ({ ...p, isCorrect: questionType === 'MULTI_SELECT' ? (j === i ? !p.isCorrect : p.isCorrect) : j === i })),
                    )
                  }
                />
                Correct
              </label>
              <button type="button" className="text-xs text-red-500" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setOptions((prev) => [...prev, { label: String.fromCharCode(65 + prev.length), text: '', isCorrect: false }])}
          >
            + Add Option
          </button>
        </Section>
      )}

      {needsNumeric && (
        <Section title="Numeric Answer">
          <Field label="Correct Answer">
            <input className="input" type="number" step="any" value={numericAnswer} onChange={(e) => setNumericAnswer(e.target.value)} />
          </Field>
        </Section>
      )}

      <Section title="Answer Guidance">
        <Field label="Expected Answer (competent)">
          <textarea className="input min-h-[70px]" value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} />
        </Field>
        <Field label="Strong Answer">
          <textarea className="input min-h-[70px]" value={strongAnswer} onChange={(e) => setStrongAnswer(e.target.value)} />
        </Field>
        <Field label="Expert Answer">
          <textarea className="input min-h-[70px]" value={expertAnswer} onChange={(e) => setExpertAnswer(e.target.value)} />
        </Field>
        <Field label="Explanation">
          <textarea className="input min-h-[70px]" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </Field>
        <Field label="Reasoning">
          <textarea className="input min-h-[70px]" value={reasoning} onChange={(e) => setReasoning(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Common Mistakes (one per line)">
            <textarea className="input min-h-[70px]" value={commonMistakes} onChange={(e) => setCommonMistakes(e.target.value)} />
          </Field>
          <Field label="Red Flags (one per line)">
            <textarea className="input min-h-[70px]" value={redFlags} onChange={(e) => setRedFlags(e.target.value)} />
          </Field>
          <Field label="P6 Checks (one per line)">
            <textarea className="input min-h-[70px]" value={p6Checks} onChange={(e) => setP6Checks(e.target.value)} />
          </Field>
        </div>
        <Field label="References (one per line)">
          <textarea className="input min-h-[50px]" value={references} onChange={(e) => setReferences(e.target.value)} />
        </Field>
      </Section>

      <Section title="Follow-up Questions">
        {followUps.map((f, i) => (
          <div key={i} className="mb-2 grid grid-cols-12 gap-2">
            <select
              className="input col-span-2"
              value={f.trigger}
              onChange={(e) => setFollowUps((prev) => prev.map((p, j) => (j === i ? { ...p, trigger: e.target.value } : p)))}
            >
              <option value="always">always</option>
              <option value="if_correct">if correct</option>
              <option value="if_partial">if partial</option>
              <option value="if_incorrect">if incorrect</option>
            </select>
            <input
              className="input col-span-5"
              placeholder="Follow-up prompt"
              value={f.prompt}
              onChange={(e) => setFollowUps((prev) => prev.map((p, j) => (j === i ? { ...p, prompt: e.target.value } : p)))}
            />
            <input
              className="input col-span-4"
              placeholder="Purpose"
              value={f.purpose}
              onChange={(e) => setFollowUps((prev) => prev.map((p, j) => (j === i ? { ...p, purpose: e.target.value } : p)))}
            />
            <button type="button" className="col-span-1 text-xs text-red-500" onClick={() => setFollowUps((prev) => prev.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary text-xs" onClick={() => setFollowUps((prev) => [...prev, { trigger: 'always', prompt: '', purpose: '' }])}>
          + Add Follow-up
        </button>
      </Section>

      {needsRubric && (
        <Section title="Scoring Rubric">
          {rubricRows.map((r, i) => (
            <div key={i} className="mb-2 grid grid-cols-12 gap-2">
              <select
                className="input col-span-3"
                value={r.name}
                onChange={(e) => setRubricRows((prev) => prev.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
              >
                {RUBRIC_DIMENSIONS.map((d) => (
                  <option key={d} value={d}>
                    {RUBRIC_DIMENSION_LABELS[d]}
                  </option>
                ))}
              </select>
              <input
                className="input col-span-1"
                type="number"
                value={r.maxScore}
                onChange={(e) => setRubricRows((prev) => prev.map((p, j) => (j === i ? { ...p, maxScore: Number(e.target.value) } : p)))}
              />
              <input
                className="input col-span-7"
                placeholder="Guidance"
                value={r.guidance}
                onChange={(e) => setRubricRows((prev) => prev.map((p, j) => (j === i ? { ...p, guidance: e.target.value } : p)))}
              />
              <button type="button" className="col-span-1 text-xs text-red-500" onClick={() => setRubricRows((prev) => prev.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary text-xs" onClick={() => setRubricRows((prev) => [...prev, { name: 'technicalAccuracy', maxScore: 5, guidance: '' }])}>
              + Add Dimension
            </button>
            <label className="text-xs text-ink-500">
              Passing score:{' '}
              <input className="input inline-block w-16" type="number" value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
            </label>
          </div>
        </Section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={submitting}>
        {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Question'}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-700">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
