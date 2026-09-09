import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';
import { CATEGORIES, COMPETENCY_GROUPS } from '@/lib/constants';

export interface QuestionFormInput {
  questionCode: string;
  categoryCode: string;
  subcategory?: string;
  competencyCode: string;
  skill?: string;
  difficulty: number;
  careerLevel: string;
  secondaryCareerLevels?: string[];
  questionType: string;
  scenario?: string;
  question: string;
  questionAr?: string;
  options?: { label: string; text: string; textAr?: string; isCorrect: boolean }[];
  correctAnswer?: unknown;
  expectedAnswer?: string;
  strongAnswer?: string;
  expertAnswer?: string;
  explanation?: string;
  reasoning?: string;
  commonMistakes?: string[];
  redFlags?: string[];
  p6Checks?: string[];
  followUpQuestions?: { trigger: string; prompt: string; purpose?: string }[];
  scoringRubric?: { dimensions: { name: string; maxScore: number; guidance?: string }[]; passingScore: number };
  weight?: number;
  estimatedTimeSec?: number;
  tags?: string[];
  references?: string[];
  projectType?: string;
  projectSituation?: string;
  givenData?: Record<string, unknown>;
  requiredAnalysis?: string;
  expectedDecision?: string;
  acceptableAlternativeAnswers?: string[];
  status?: string;
}

async function resolveIds(categoryCode: string, competencyCode: string) {
  const [category, competency] = await Promise.all([
    prisma.category.findUnique({ where: { code: categoryCode } }),
    prisma.competency.findUnique({ where: { code: competencyCode } }),
  ]);
  if (!category) throw new Error(`Unknown category code: ${categoryCode}`);
  if (!competency) throw new Error(`Unknown competency code: ${competencyCode}`);
  return { categoryId: category.id, competencyId: competency.id };
}

function scalarData(input: QuestionFormInput, categoryId: string, competencyId: string) {
  return {
    questionCode: input.questionCode,
    categoryId,
    subcategory: input.subcategory ?? null,
    competencyId,
    skill: input.skill ?? null,
    difficulty: input.difficulty,
    careerLevel: input.careerLevel,
    secondaryCareerLevels: toJson(input.secondaryCareerLevels ?? []),
    questionType: input.questionType,
    scenario: input.scenario ?? null,
    question: input.question,
    questionAr: input.questionAr ?? null,
    correctAnswer: toJson(input.correctAnswer ?? null),
    expectedAnswer: input.expectedAnswer ?? null,
    strongAnswer: input.strongAnswer ?? null,
    expertAnswer: input.expertAnswer ?? null,
    explanation: input.explanation ?? null,
    reasoning: input.reasoning ?? null,
    commonMistakes: toJson(input.commonMistakes ?? []),
    redFlags: toJson(input.redFlags ?? []),
    p6Checks: toJson(input.p6Checks ?? []),
    followUpQuestions: toJson(input.followUpQuestions ?? []),
    scoringRubric: input.scoringRubric ? toJson(input.scoringRubric) : null,
    weight: input.weight ?? 1,
    estimatedTimeSec: input.estimatedTimeSec ?? 90,
    tags: toJson(input.tags ?? []),
    references: toJson(input.references ?? []),
    projectType: input.projectType ?? null,
    projectSituation: input.projectSituation ?? null,
    givenData: input.givenData ? toJson(input.givenData) : null,
    requiredAnalysis: input.requiredAnalysis ?? null,
    expectedDecision: input.expectedDecision ?? null,
    acceptableAlternativeAnswers: toJson(input.acceptableAlternativeAnswers ?? []),
    status: input.status ?? 'DRAFT',
  };
}

export async function createQuestion(input: QuestionFormInput, authorId?: string) {
  const { categoryId, competencyId } = await resolveIds(input.categoryCode, input.competencyCode);
  const question = await prisma.question.create({
    data: {
      ...scalarData(input, categoryId, competencyId),
      authorId,
      options: input.options?.length ? { create: input.options.map((o, i) => ({ ...o, order: i })) } : undefined,
      tagLinks: input.tags?.length ? { create: input.tags.map((tag) => ({ tag })) } : undefined,
    },
  });
  return question;
}

export async function updateQuestion(id: string, input: QuestionFormInput, authorId?: string, changeNote?: string) {
  const existing = await prisma.question.findUniqueOrThrow({ where: { id } });
  await prisma.questionVersion.create({
    data: { questionId: id, versionNumber: existing.version, snapshot: toJson(existing) ?? '{}', authorId, changeNote },
  });

  const { categoryId, competencyId } = await resolveIds(input.categoryCode, input.competencyCode);

  await prisma.$transaction([
    prisma.questionOption.deleteMany({ where: { questionId: id } }),
    prisma.questionTagLink.deleteMany({ where: { questionId: id } }),
  ]);

  const question = await prisma.question.update({
    where: { id },
    data: {
      ...scalarData(input, categoryId, competencyId),
      version: existing.version + 1,
      options: input.options?.length ? { create: input.options.map((o, i) => ({ ...o, order: i })) } : undefined,
      tagLinks: input.tags?.length ? { create: input.tags.map((tag) => ({ tag })) } : undefined,
    },
  });
  return question;
}

export function categoryOptions() {
  return CATEGORIES;
}
export function competencyOptions() {
  return COMPETENCY_GROUPS;
}
