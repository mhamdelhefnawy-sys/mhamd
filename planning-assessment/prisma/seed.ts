/**
 * Master seed script (§53/§56). Idempotent: safe to re-run — categories,
 * competencies, thresholds and users are upserted; questions are upserted
 * by questionCode; demo assessments are only created if they don't already
 * exist for a given demo candidate + mode combination.
 *
 * Run with `npm run db:seed` (or automatically via `prisma migrate dev`'s
 * seed hook once configured).
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from '../src/lib/auth/password';
import { toJson } from '../src/lib/json';
import { CATEGORIES, COMPETENCY_GROUPS, type CompetencyGroupCode } from '../src/lib/constants';
import { defaultThresholds } from '../src/lib/engine/classification';
import { questionArraySchema, type QuestionInput } from '../src/lib/validation/questionSchema';
import { computeAssessmentScores } from '../src/lib/engine/results';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Passw0rd!123';

async function seedTaxonomy() {
  for (const g of COMPETENCY_GROUPS) {
    await prisma.competency.upsert({
      where: { code: g.code },
      update: { name: g.name, group: g.code, defaultWeight: g.weight, isCritical: g.isCritical },
      create: { code: g.code, name: g.name, group: g.code, defaultWeight: g.weight, isCritical: g.isCritical },
    });
  }
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { code: c.code, name: c.name, order: CATEGORIES.indexOf(c) },
    });
  }
  for (const t of defaultThresholds()) {
    await prisma.levelThreshold.upsert({
      where: { level: t.level },
      update: { order: t.order, minOverallScore: t.minOverallScore, minCriticalCompetencyScore: toJson(t.minCriticalCompetencyScore) ?? '{}' },
      create: { level: t.level, order: t.order, minOverallScore: t.minOverallScore, minCriticalCompetencyScore: toJson(t.minCriticalCompetencyScore) ?? '{}' },
    });
  }
  console.log(`Seeded ${COMPETENCY_GROUPS.length} competencies, ${CATEGORIES.length} categories, ${defaultThresholds().length} level thresholds.`);
}

async function seedUsers() {
  const users = [
    { name: 'Ahmed Al-Rashid', email: 'admin@peassess.io', role: 'ADMIN' },
    { name: 'Laila Haddad', email: 'manager@peassess.io', role: 'ASSESSMENT_MANAGER' },
    { name: 'Omar Farouk', email: 'interviewer@peassess.io', role: 'INTERVIEWER' },
    { name: 'Nadia Youssef', email: 'viewer@peassess.io', role: 'VIEWER' },
  ];
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const created: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
    created[u.email] = row.id;
  }
  console.log(`Seeded ${users.length} staff users. Demo password for all: ${DEMO_PASSWORD}`);
  return created;
}

interface DemoCandidateSpec {
  email: string;
  fullName: string;
  currentPosition: string;
  targetPosition: string;
  yearsExperience: number;
  primaryProjectType: string;
  profile: Partial<Record<CompetencyGroupCode, [number, number]>>; // [minScore,maxScore] band per competency
}

const DEMO_CANDIDATES: DemoCandidateSpec[] = [
  {
    email: 'candidate.strong@peassess.io',
    fullName: 'Youssef Al-Amin',
    currentPosition: 'Planning Engineer',
    targetPosition: 'Senior Planning Engineer',
    yearsExperience: 6,
    primaryProjectType: 'Oil & Gas EPC',
    profile: {
      P6: [85, 96],
      PLANNING_CPM: [78, 90],
      SCHEDULE_ANALYSIS: [72, 85],
      PROJECT_CONTROLS_EVM: [65, 78],
      DELAY_CLAIMS: [28, 42],
      CONSTRUCTION_METHODOLOGY: [60, 72],
      ANALYTICAL_THINKING: [55, 68],
      MANAGEMENT_COMM_ETHICS: [60, 72],
    },
  },
  {
    email: 'candidate.gap@peassess.io',
    fullName: 'Karim Mansour',
    currentPosition: 'Planning Engineer',
    targetPosition: 'Senior Planning Engineer',
    yearsExperience: 5,
    primaryProjectType: 'High-rise Residential',
    profile: {
      CONSTRUCTION_METHODOLOGY: [82, 94],
      MANAGEMENT_COMM_ETHICS: [70, 82],
      P6: [50, 62],
      PLANNING_CPM: [40, 55],
      SCHEDULE_ANALYSIS: [55, 68],
      PROJECT_CONTROLS_EVM: [55, 68],
      DELAY_CLAIMS: [45, 58],
      ANALYTICAL_THINKING: [50, 62],
    },
  },
  {
    email: 'candidate.evm-gap@peassess.io',
    fullName: 'Sara Ibrahim',
    currentPosition: 'Planning Engineer',
    targetPosition: 'Planning Engineer',
    yearsExperience: 3,
    primaryProjectType: 'Infrastructure / Roads',
    profile: {
      PLANNING_CPM: [75, 88],
      SCHEDULE_ANALYSIS: [68, 80],
      P6: [65, 78],
      PROJECT_CONTROLS_EVM: [30, 44],
      DELAY_CLAIMS: [40, 55],
      CONSTRUCTION_METHODOLOGY: [55, 68],
      ANALYTICAL_THINKING: [55, 66],
      MANAGEMENT_COMM_ETHICS: [50, 62],
    },
  },
  {
    email: 'candidate.senior@peassess.io',
    fullName: 'Hana Qureshi',
    currentPosition: 'Senior Planning Engineer',
    targetPosition: 'Planning Manager',
    yearsExperience: 12,
    primaryProjectType: 'Multi-project Infrastructure Program',
    profile: {
      PLANNING_CPM: [85, 95],
      P6: [82, 93],
      SCHEDULE_ANALYSIS: [80, 92],
      PROJECT_CONTROLS_EVM: [78, 90],
      DELAY_CLAIMS: [80, 92],
      CONSTRUCTION_METHODOLOGY: [78, 88],
      ANALYTICAL_THINKING: [80, 90],
      MANAGEMENT_COMM_ETHICS: [82, 92],
    },
  },
];

async function seedCandidates() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids: Record<string, string> = {};
  for (const spec of DEMO_CANDIDATES) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { name: spec.fullName, role: 'CANDIDATE' },
      create: { name: spec.fullName, email: spec.email, role: 'CANDIDATE', passwordHash },
    });
    const candidate = await prisma.candidate.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        userId: user.id,
        fullName: spec.fullName,
        email: spec.email,
        currentPosition: spec.currentPosition,
        targetPosition: spec.targetPosition,
        yearsExperience: spec.yearsExperience,
        primaryProjectType: spec.primaryProjectType,
        organization: 'Demo Contracting Co.',
      },
    });
    ids[spec.email] = candidate.id;
  }
  console.log(`Seeded ${DEMO_CANDIDATES.length} demo candidates.`);
  return ids;
}

async function seedQuestions() {
  const dir = path.join(__dirname, '..', 'content', 'questions');
  if (!fs.existsSync(dir)) {
    console.warn('No content/questions directory found — skipping question seed.');
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const categoryMap = new Map((await prisma.category.findMany()).map((c) => [c.code, c.id]));
  const competencyMap = new Map((await prisma.competency.findMany()).map((c) => [c.code, c.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    } catch (e) {
      console.warn(`  [skip file] ${file}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    const result = questionArraySchema.safeParse(raw);
    const list: QuestionInput[] = result.success ? result.data : [];
    if (!result.success) {
      console.warn(`  [partial] ${file}: ${result.error.issues.length} schema issue(s) — attempting per-question fallback parse.`);
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const single = questionArraySchema.element.safeParse(item);
          if (single.success) list.push(single.data);
        }
      }
    }

    for (const q of list) {
      const categoryId = categoryMap.get(q.category);
      const competencyId = competencyMap.get(q.competency);
      if (!categoryId || !competencyId) {
        skipped++;
        continue;
      }
      const data = {
        categoryId,
        subcategory: q.subcategory,
        competencyId,
        skill: q.skill,
        difficulty: q.difficulty,
        careerLevel: q.careerLevel,
        secondaryCareerLevels: toJson(q.secondaryCareerLevels ?? []),
        questionType: q.questionType,
        scenario: q.scenario ?? null,
        question: q.question,
        questionAr: q.questionAr ?? null,
        correctAnswer: toJson(q.correctAnswer ?? null),
        expectedAnswer: q.expectedAnswer ?? null,
        strongAnswer: q.strongAnswer ?? null,
        expertAnswer: q.expertAnswer ?? null,
        explanation: q.explanation ?? null,
        reasoning: q.reasoning ?? null,
        commonMistakes: toJson(q.commonMistakes ?? []),
        redFlags: toJson(q.redFlags ?? []),
        p6Checks: toJson(q.p6Checks ?? []),
        followUpQuestions: toJson(q.followUpQuestions ?? []),
        scoringRubric: q.scoringRubric ? toJson(q.scoringRubric) : null,
        weight: q.weight ?? 1,
        estimatedTimeSec: q.estimatedTimeSec ?? 90,
        tags: toJson(q.tags ?? []),
        references: toJson(q.references ?? []),
        projectType: q.projectType ?? null,
        projectSituation: q.projectSituation ?? null,
        givenData: q.givenData ? toJson(q.givenData) : null,
        requiredAnalysis: q.requiredAnalysis ?? null,
        expectedDecision: q.expectedDecision ?? null,
        acceptableAlternativeAnswers: toJson(q.acceptableAlternativeAnswers ?? []),
        status: 'PUBLISHED',
      };

      const existing = await prisma.question.findUnique({ where: { questionCode: q.questionCode } });
      if (existing) {
        await prisma.questionOption.deleteMany({ where: { questionId: existing.id } });
        await prisma.question.update({
          where: { id: existing.id },
          data: { ...data, questionCode: q.questionCode, options: q.options?.length ? { create: q.options.map((o, i) => ({ ...o, order: i })) } : undefined },
        });
        updated++;
      } else {
        await prisma.question.create({
          data: { ...data, questionCode: q.questionCode, options: q.options?.length ? { create: q.options.map((o, i) => ({ ...o, order: i })) } : undefined },
        });
        created++;
      }
    }
    console.log(`  [${file}] ${list.length} questions processed.`);
  }
  console.log(`Seeded questions: ${created} created, ${updated} updated, ${skipped} skipped (unknown category/competency).`);
}

async function seedDemoAssessment(candidateId: string, spec: DemoCandidateSpec, createdById: string) {
  const existing = await prisma.assessment.findFirst({ where: { candidateId, mode: 'FULL' } });
  if (existing) return;

  const questionsPerCompetency = 8;
  const selectedQuestions: { id: string; competencyCode: CompetencyGroupCode; estimatedTimeSec: number }[] = [];

  for (const group of COMPETENCY_GROUPS) {
    const pool = await prisma.question.findMany({
      where: { competency: { code: group.code }, isActive: true, status: 'PUBLISHED' },
      take: questionsPerCompetency,
      orderBy: { questionCode: 'asc' },
    });
    pool.forEach((q) => selectedQuestions.push({ id: q.id, competencyCode: group.code, estimatedTimeSec: q.estimatedTimeSec }));
  }
  if (selectedQuestions.length === 0) return;

  const assessment = await prisma.assessment.create({
    data: {
      code: `DEMO-${spec.email.split('@')[0].toUpperCase()}`,
      candidateId,
      mode: 'FULL',
      status: 'IN_PROGRESS',
      isAdaptive: false,
      randomizeOrder: false,
      createdById,
      startedAt: new Date(Date.now() - 1000 * 60 * 90),
      config: toJson({ resolved: { competencyPool: COMPETENCY_GROUPS.map((g) => g.code), categoryPool: [], careerLevels: [], questionCount: selectedQuestions.length, randomizeOrder: false, isAdaptive: false, trainingMode: false }, slotCursor: selectedQuestions.length }),
    },
  });

  for (let i = 0; i < selectedQuestions.length; i++) {
    const sq = selectedQuestions[i];
    const band = spec.profile[sq.competencyCode] ?? [55, 70];
    const score = Math.round(band[0] + Math.random() * (band[1] - band[0]));
    const aq = await prisma.assessmentQuestion.create({
      data: { assessmentId: assessment.id, questionId: sq.id, order: i, status: 'ANSWERED' },
    });
    await prisma.answer.create({
      data: {
        assessmentQuestionId: aq.id,
        candidateAnswer: toJson('A'),
        isCorrect: score >= 60,
        autoScore: score,
        finalScore: score,
        timeSpentSec: Math.round(sq.estimatedTimeSec * (0.7 + Math.random() * 0.6)),
        answeredAt: new Date(),
      },
    });
  }

  await computeAssessmentScores(assessment.id);
  console.log(`  Seeded demo assessment for ${spec.fullName} (${selectedQuestions.length} answers).`);
}

async function seedProjects() {
  const projects = [
    { name: 'Al-Noor Residential Towers', type: 'High-rise Residential' },
    { name: 'North Corridor Highway Expansion', type: 'Infrastructure / Roads' },
    { name: 'Ras Al-Khair Gas Processing Plant', type: 'Oil & Gas EPC' },
    { name: 'Marina Bay Data Center Campus', type: 'Data Center' },
    { name: 'Corniche Metro Extension', type: 'Rail / Infrastructure' },
  ];
  for (const p of projects) {
    const exists = await prisma.project.findFirst({ where: { name: p.name } });
    if (!exists) await prisma.project.create({ data: p });
  }
  console.log(`Seeded ${projects.length} reference projects.`);
}

async function main() {
  console.log('--- Seeding taxonomy (categories, competencies, thresholds) ---');
  await seedTaxonomy();

  console.log('--- Seeding staff users ---');
  const staff = await seedUsers();

  console.log('--- Seeding question bank from content/questions/*.json ---');
  await seedQuestions();

  console.log('--- Seeding demo candidates ---');
  const candidateIds = await seedCandidates();

  console.log('--- Seeding demo assessments (candidate competency profiles) ---');
  for (const spec of DEMO_CANDIDATES) {
    await seedDemoAssessment(candidateIds[spec.email], spec, staff['manager@peassess.io']);
  }

  console.log('--- Seeding reference projects ---');
  await seedProjects();

  const questionCount = await prisma.question.count();
  console.log(`\nSeed complete. ${questionCount} questions in the bank.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
