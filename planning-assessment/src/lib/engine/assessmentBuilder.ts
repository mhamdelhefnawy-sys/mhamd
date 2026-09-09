import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';
import {
  ASSESSMENT_MODE_META,
  COMPETENCY_GROUPS,
  type AssessmentMode,
  type CompetencyGroupCode,
} from '@/lib/constants';
import { proportionalAllocation, shuffle } from './randomization';
import { initAbilityState } from './adaptive';

export interface AssessmentConfigInput {
  competencyCodes?: CompetencyGroupCode[];
  categoryCodes?: string[];
  careerLevels?: string[];
  questionCount?: number;
  timeLimitSec?: number;
  randomizeOrder?: boolean;
  isAdaptive?: boolean;
}

const DIFFICULTY_WEIGHTS_DEFAULT: Record<number, number> = { 1: 10, 2: 25, 3: 35, 4: 20, 5: 10 };
const DIFFICULTY_WEIGHTS_BROAD: Record<number, number> = { 1: 10, 2: 20, 3: 30, 4: 25, 5: 15 };
const DIFFICULTY_WEIGHTS_SENIOR: Record<number, number> = { 3: 15, 4: 45, 5: 40 };

function difficultyWeightsForMode(mode: AssessmentMode): Record<number, number> {
  if (mode === 'SENIOR_MANAGER') return DIFFICULTY_WEIGHTS_SENIOR;
  if (mode === 'FULL' || mode === 'CERTIFICATION') return DIFFICULTY_WEIGHTS_BROAD;
  return DIFFICULTY_WEIGHTS_DEFAULT;
}

function pickWeighted(weights: Record<number, number>): number {
  const entries = Object.entries(weights).map(([k, v]) => [Number(k), v] as [number, number]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [level, w] of entries) {
    if (r < w) return level;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function defaultModeScope(mode: AssessmentMode): { competencyCodes: CompetencyGroupCode[]; careerLevels?: string[] } {
  if (mode === 'PRACTICAL_P6') return { competencyCodes: ['P6'] };
  if (mode === 'SENIOR_MANAGER') return { competencyCodes: COMPETENCY_GROUPS.map((g) => g.code), careerLevels: ['SENIOR', 'LEAD', 'MANAGER'] };
  return { competencyCodes: COMPETENCY_GROUPS.map((g) => g.code) };
}

export interface QuestionSlot {
  competency: CompetencyGroupCode;
  difficulty: number;
}

/** Builds the ordered {competency, difficulty} plan for every slot in the assessment (§28 weighted coverage + §23 difficulty targeting). */
export async function planQuestionSlots(
  mode: AssessmentMode,
  questionCount: number,
  competencyPool: CompetencyGroupCode[],
): Promise<QuestionSlot[]> {
  const weights = await prisma.competency.findMany({ where: { code: { in: competencyPool } } });
  const buckets = weights.map((c) => ({
    key: c.code,
    weight: c.defaultWeight || 1,
    available: 999,
    minEach: mode === 'QUICK' ? 0 : 1,
  }));
  const allocation = proportionalAllocation(buckets, questionCount);
  const dWeights = difficultyWeightsForMode(mode);

  const slots: QuestionSlot[] = [];
  Object.entries(allocation).forEach(([competency, count]) => {
    for (let i = 0; i < count; i++) {
      slots.push({ competency: competency as CompetencyGroupCode, difficulty: pickWeighted(dWeights) });
    }
  });
  return shuffle(slots);
}

function resolveQuestionCount(mode: AssessmentMode, requested?: number): number {
  const [min, max] = ASSESSMENT_MODE_META[mode].questionRange;
  if (requested && requested >= min && requested <= max) return requested;
  return Math.round((min + max) / 2);
}

/**
 * Creates an Assessment. Fixed-plan modes get every AssessmentQuestion row
 * populated immediately (option order pre-shuffled per candidate). Adaptive
 * modes (§23) get the competency/difficulty *plan* stored in `config`, but
 * only the first question materialized — subsequent questions are chosen
 * one at a time by the adaptive engine as each answer comes back, so
 * difficulty can respond to live performance instead of being fixed
 * upfront. See src/lib/engine/adaptive.ts.
 */
export async function createAssessment(params: {
  candidateId: string;
  mode: AssessmentMode;
  createdById?: string;
  targetPosition?: string;
  projectTypeContext?: string;
  config?: AssessmentConfigInput;
}) {
  const { candidateId, mode, createdById, targetPosition, projectTypeContext } = params;
  const cfg = params.config ?? {};
  const scope = defaultModeScope(mode);
  const competencyPool = cfg.competencyCodes?.length ? cfg.competencyCodes : scope.competencyCodes;
  const careerLevels = cfg.careerLevels?.length ? cfg.careerLevels : scope.careerLevels;
  const questionCount = resolveQuestionCount(mode, cfg.questionCount);
  const isAdaptive = cfg.isAdaptive ?? !['TRAINING', 'INTERVIEW'].includes(mode);
  const randomizeOrder = cfg.randomizeOrder ?? true;

  const slots = await planQuestionSlots(mode, questionCount, competencyPool);

  const resolvedConfig = {
    resolved: {
      competencyPool,
      categoryPool: cfg.categoryCodes ?? [],
      careerLevels: careerLevels ?? [],
      questionCount,
      randomizeOrder,
      isAdaptive,
      trainingMode: mode === 'TRAINING',
    },
    plannedSlots: isAdaptive ? slots : undefined,
    ability: isAdaptive ? initAbilityState() : undefined,
    slotCursor: 0,
  };

  const assessment = await prisma.assessment.create({
    data: {
      code: `ASM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      candidateId,
      mode,
      status: 'NOT_STARTED',
      config: toJson(resolvedConfig),
      createdById,
      targetPosition,
      projectTypeContext,
      isAdaptive,
      randomizeOrder,
      timeLimitSec: cfg.timeLimitSec,
    },
  });

  if (!isAdaptive) {
    await materializeFixedPlan(assessment.id, slots, cfg.categoryCodes, careerLevels, randomizeOrder);
  } else {
    // Materialize just the first slot so the candidate has something to answer immediately.
    const { fillNextAdaptiveQuestion } = await import('./adaptiveRuntime');
    await fillNextAdaptiveQuestion(assessment.id);
  }

  return assessment;
}

async function materializeFixedPlan(
  assessmentId: string,
  slots: QuestionSlot[],
  categoryCodes: string[] | undefined,
  careerLevels: string[] | undefined,
  randomizeOrder: boolean,
) {
  const categoryRows = categoryCodes?.length ? await prisma.category.findMany({ where: { code: { in: categoryCodes } } }) : [];
  const used = new Set<string>();
  const chosen: { questionId: string; optionIds: string[] }[] = [];

  for (const slot of slots) {
    const competencyRow = await prisma.competency.findUnique({ where: { code: slot.competency } });
    if (!competencyRow) continue;
    let candidates = await prisma.question.findMany({
      where: {
        competencyId: competencyRow.id,
        isActive: true,
        status: 'PUBLISHED',
        difficulty: { gte: Math.max(1, slot.difficulty - 1), lte: Math.min(5, slot.difficulty + 1) },
        ...(categoryRows.length ? { categoryId: { in: categoryRows.map((c) => c.id) } } : {}),
        ...(careerLevels?.length ? { careerLevel: { in: careerLevels } } : {}),
        id: { notIn: [...used] },
      },
      include: { options: true },
      take: 40,
    });
    if (candidates.length === 0) {
      candidates = await prisma.question.findMany({
        where: { competencyId: competencyRow.id, isActive: true, status: 'PUBLISHED', id: { notIn: [...used] } },
        include: { options: true },
        take: 40,
      });
    }
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(pick.id);
    chosen.push({ questionId: pick.id, optionIds: shuffle(pick.options.map((o) => o.id)) });
  }

  const ordered = randomizeOrder ? shuffle(chosen) : chosen;
  await prisma.$transaction(
    ordered.map((c, i) =>
      prisma.assessmentQuestion.create({
        data: {
          assessmentId,
          questionId: c.questionId,
          order: i,
          presentedOptionsOrder: toJson(c.optionIds),
          status: 'PENDING',
        },
      }),
    ),
  );
}
