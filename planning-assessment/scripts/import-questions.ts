/**
 * CLI question import (§34): `npm run questions:import -- path/to/file.json`
 * Validates against the same schema as the seed step and the admin UI's
 * import endpoint, then upserts by questionCode. Use this for bulk-loading
 * a new batch of authored content outside the web UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { questionArraySchema } from '../src/lib/validation/questionSchema';
import { toJson } from '../src/lib/json';

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run questions:import -- <path-to-json-file>');
    process.exit(1);
  }
  const full = path.resolve(process.cwd(), file);
  const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
  const result = questionArraySchema.safeParse(raw);
  if (!result.success) {
    console.error(`Validation failed with ${result.error.issues.length} issue(s):`);
    result.error.issues.slice(0, 30).forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
    process.exit(1);
  }

  const categoryMap = new Map((await prisma.category.findMany()).map((c) => [c.code, c.id]));
  const competencyMap = new Map((await prisma.competency.findMany()).map((c) => [c.code, c.id]));

  let created = 0;
  let updated = 0;
  for (const q of result.data) {
    const categoryId = categoryMap.get(q.category);
    const competencyId = competencyMap.get(q.competency);
    if (!categoryId || !competencyId) {
      console.warn(`Skipping ${q.questionCode}: unknown category/competency code.`);
      continue;
    }
    const data = {
      categoryId,
      subcategory: q.subcategory,
      competencyId,
      skill: q.skill,
      difficulty: q.difficulty,
      careerLevel: q.careerLevel,
      questionType: q.questionType,
      scenario: q.scenario ?? null,
      question: q.question,
      correctAnswer: toJson(q.correctAnswer ?? null),
      expectedAnswer: q.expectedAnswer ?? null,
      explanation: q.explanation ?? null,
      reasoning: q.reasoning ?? null,
      scoringRubric: q.scoringRubric ? toJson(q.scoringRubric) : null,
      tags: toJson(q.tags ?? []),
      status: 'PUBLISHED',
    };
    const existing = await prisma.question.findUnique({ where: { questionCode: q.questionCode } });
    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.question.create({ data: { ...data, questionCode: q.questionCode, options: q.options?.length ? { create: q.options.map((o, i) => ({ ...o, order: i })) } : undefined } });
      created++;
    }
  }
  console.log(`Import complete: ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
