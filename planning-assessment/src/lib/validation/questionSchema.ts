import { z } from 'zod';
import { CAREER_LEVELS, CATEGORIES, COMPETENCY_GROUPS, QUESTION_TYPES } from '@/lib/constants';

const categoryCodes = CATEGORIES.map((c) => c.code) as [string, ...string[]];
const competencyCodes = COMPETENCY_GROUPS.map((c) => c.code) as [string, ...string[]];

export const optionSchema = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
  textAr: z.string().optional(),
  isCorrect: z.boolean().optional().default(false),
});

export const followUpSchema = z.object({
  trigger: z.enum(['if_correct', 'if_partial', 'if_incorrect', 'always']),
  prompt: z.string().min(1),
  purpose: z.string().optional(),
});

export const rubricDimensionSchema = z.object({
  name: z.enum([
    'technicalAccuracy',
    'reasoning',
    'completeness',
    'practicalApplication',
    'p6Understanding',
    'causeAndEffect',
    'professionalJudgment',
  ]),
  maxScore: z.number().min(1).max(10).default(5),
  guidance: z.string().optional(),
});

export const scoringRubricSchema = z.object({
  dimensions: z.array(rubricDimensionSchema).min(1),
  passingScore: z.number().min(0),
});

export const questionInputSchema = z
  .object({
    questionCode: z.string().min(2),
    category: z.enum(categoryCodes),
    subcategory: z.string().min(1),
    competency: z.enum(competencyCodes),
    skill: z.string().min(1),
    difficulty: z.number().int().min(1).max(5),
    careerLevel: z.enum(CAREER_LEVELS),
    secondaryCareerLevels: z.array(z.enum(CAREER_LEVELS)).optional(),
    questionType: z.enum(QUESTION_TYPES),
    scenario: z.string().optional(),
    question: z.string().min(5),
    questionAr: z.string().optional(),
    options: z.array(optionSchema).optional(),
    correctAnswer: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]).optional(),
    expectedAnswer: z.string().optional(),
    strongAnswer: z.string().optional(),
    expertAnswer: z.string().optional(),
    explanation: z.string().optional(),
    reasoning: z.string().optional(),
    commonMistakes: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).optional(),
    p6Checks: z.array(z.string()).optional(),
    followUpQuestions: z.array(followUpSchema).optional(),
    scoringRubric: scoringRubricSchema.optional(),
    weight: z.number().positive().optional().default(1),
    estimatedTimeSec: z.number().int().positive().optional().default(90),
    tags: z.array(z.string()).optional(),
    references: z.array(z.string()).optional(),
    projectType: z.string().optional(),
    projectSituation: z.string().optional(),
    givenData: z.record(z.union([z.number(), z.string()])).optional(),
    requiredAnalysis: z.string().optional(),
    expectedDecision: z.string().optional(),
    acceptableAlternativeAnswers: z.array(z.string()).optional(),
  })
  .superRefine((q, ctx) => {
    const AUTO = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'NUMERICAL'];
    const OPEN = [
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
    ];
    if (AUTO.includes(q.questionType)) {
      if (q.correctAnswer === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${q.questionCode}: auto-scored type ${q.questionType} requires correctAnswer` });
      }
      if ((q.questionType === 'MCQ' || q.questionType === 'MULTI_SELECT' || q.questionType === 'TRUE_FALSE') && (!q.options || q.options.length < 2)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${q.questionCode}: ${q.questionType} requires >= 2 options` });
      }
      if (q.options?.length && !q.options.some((o) => o.isCorrect)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${q.questionCode}: no option marked isCorrect` });
      }
    }
    if (OPEN.includes(q.questionType) && !q.scoringRubric) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${q.questionCode}: open-ended type ${q.questionType} requires scoringRubric` });
    }
    if (!q.explanation && !q.expectedAnswer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${q.questionCode}: needs explanation or expectedAnswer` });
    }
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;
export const questionArraySchema = z.array(questionInputSchema);
