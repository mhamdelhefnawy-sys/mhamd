import { prisma } from '@/lib/db';
import { fromJson, toJson } from '@/lib/json';
import { shuffle } from './randomization';
import { pickNextQuestion, updateAbility, nextDifficultyFor, type AbilityState } from './adaptive';
import type { QuestionSlot } from './assessmentBuilder';
import type { CompetencyGroupCode } from '@/lib/constants';

interface StoredConfig {
  resolved: {
    competencyPool: CompetencyGroupCode[];
    categoryPool: string[];
    careerLevels: string[];
    questionCount: number;
    randomizeOrder: boolean;
    isAdaptive: boolean;
    trainingMode: boolean;
  };
  plannedSlots?: QuestionSlot[];
  ability?: AbilityState;
  slotCursor: number;
}

async function loadConfig(assessmentId: string): Promise<{ assessment: NonNullable<Awaited<ReturnType<typeof prisma.assessment.findUnique>>>; cfg: StoredConfig }> {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw new Error('Assessment not found');
  const cfg = fromJson<StoredConfig>(assessment.config, {
    resolved: {
      competencyPool: [],
      categoryPool: [],
      careerLevels: [],
      questionCount: 0,
      randomizeOrder: true,
      isAdaptive: false,
      trainingMode: false,
    },
    slotCursor: 0,
  });
  return { assessment, cfg };
}

/** Materializes the next AssessmentQuestion for an adaptive assessment, or returns null if the plan is exhausted. */
export async function fillNextAdaptiveQuestion(assessmentId: string) {
  const { cfg } = await loadConfig(assessmentId);
  const slots = cfg.plannedSlots ?? [];
  const cursor = cfg.slotCursor ?? 0;
  if (cursor >= slots.length) return null;

  const already = await prisma.assessmentQuestion.findMany({ where: { assessmentId }, select: { questionId: true } });
  const excludeIds = already.map((a) => a.questionId);

  const slot = slots[cursor];
  const ability = cfg.ability ?? { byCompetency: {}, streak: {} };
  const targetDifficulty = ability.byCompetency[slot.competency] != null ? nextDifficultyFor(ability, slot.competency) : slot.difficulty;

  const question = await pickNextQuestion({
    competency: slot.competency,
    targetDifficulty,
    categoryCodes: cfg.resolved.categoryPool,
    careerLevels: cfg.resolved.careerLevels,
    excludeQuestionIds: excludeIds,
  });
  if (!question) {
    // Pool exhausted for this competency — skip the slot and try the next one.
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { config: toJson({ ...cfg, slotCursor: cursor + 1 }) },
    });
    return fillNextAdaptiveQuestion(assessmentId);
  }

  const optionIds = shuffle((question as unknown as { options: { id: string }[] }).options.map((o) => o.id));

  const aq = await prisma.assessmentQuestion.create({
    data: {
      assessmentId,
      questionId: question.id,
      order: cursor,
      presentedOptionsOrder: toJson(optionIds),
      status: 'PENDING',
    },
  });

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { config: toJson({ ...cfg, slotCursor: cursor + 1 }) },
  });

  return aq;
}

/** Call after an answer is scored: updates the running ability estimate and materializes the next question (adaptive) or reports completion. */
export async function advanceAdaptiveAssessment(params: {
  assessmentId: string;
  competency: CompetencyGroupCode;
  difficulty: number;
  scorePct: number;
  timeSpentSec: number;
  estimatedTimeSec: number;
}) {
  const { assessment, cfg } = await loadConfig(params.assessmentId);
  if (!cfg.resolved.isAdaptive) return { done: false };

  const ability = updateAbility(
    cfg.ability ?? { byCompetency: {}, streak: {} },
    params.competency,
    params.difficulty,
    params.scorePct,
    params.timeSpentSec,
    params.estimatedTimeSec,
  );

  await prisma.assessment.update({ where: { id: assessment.id }, data: { config: toJson({ ...cfg, ability }) } });

  const next = await fillNextAdaptiveQuestion(assessment.id);
  return { done: next === null };
}
