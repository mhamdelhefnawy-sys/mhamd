/**
 * Validates every content/questions/*.json file against the question
 * schema (src/lib/validation/questionSchema.ts), and checks cross-file
 * integrity: unique questionCode, category coverage vs the §3 minimums in
 * src/lib/constants.ts, and a rough question-type balance check (§4: ≥70%
 * practical/scenario/analytical types). Run with `npm run questions:validate`.
 * Exits non-zero on any hard error so it can gate the seed step / CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { questionArraySchema } from '../src/lib/validation/questionSchema';
import { CATEGORIES } from '../src/lib/constants';

const CONTENT_DIR = path.join(__dirname, '..', 'content', 'questions');
const CLOSED_FORM_TYPES = new Set(['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'NUMERICAL']);

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('No question JSON files found yet in content/questions/.');
    process.exit(1);
  }

  const allQuestions: { file: string; q: (typeof questionArraySchema)['_output'][number] }[] = [];
  let hardErrors = 0;

  for (const file of files) {
    const full = path.join(CONTENT_DIR, file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
    } catch (e) {
      console.error(`[PARSE ERROR] ${file}: ${(e as Error).message}`);
      hardErrors++;
      continue;
    }
    const result = questionArraySchema.safeParse(raw);
    if (!result.success) {
      console.error(`[SCHEMA ERRORS] ${file}: ${result.error.issues.length} issue(s)`);
      for (const issue of result.error.issues.slice(0, 25)) {
        console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
      }
      if (result.error.issues.length > 25) console.error(`   ... and ${result.error.issues.length - 25} more`);
      hardErrors++;
      continue;
    }
    for (const q of result.data) allQuestions.push({ file, q });
    console.log(`[OK] ${file}: ${result.data.length} questions`);
  }

  // Cross-file uniqueness
  const codeMap = new Map<string, string>();
  for (const { file, q } of allQuestions) {
    const existing = codeMap.get(q.questionCode);
    if (existing) {
      console.error(`[DUPLICATE questionCode] ${q.questionCode} in ${file} and ${existing}`);
      hardErrors++;
    } else {
      codeMap.set(q.questionCode, file);
    }
  }

  // Category coverage vs minimums
  const byCategory = new Map<string, number>();
  for (const { q } of allQuestions) byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
  console.log('\n--- Category coverage vs. §3 minimums ---');
  for (const cat of CATEGORIES) {
    const count = byCategory.get(cat.code) ?? 0;
    const flag = count < cat.minQuestions ? '  <-- BELOW MINIMUM' : '';
    console.log(`${cat.code.padEnd(6)} ${cat.name.padEnd(38)} ${String(count).padStart(4)} / ${cat.minQuestions}${flag}`);
    if (count < cat.minQuestions) hardErrors++;
  }

  // Question-type balance (§4: >= 70% practical/scenario types)
  const closedForm = allQuestions.filter(({ q }) => CLOSED_FORM_TYPES.has(q.questionType)).length;
  const practicalPct = allQuestions.length ? (1 - closedForm / allQuestions.length) * 100 : 0;
  console.log(`\n--- Question type balance ---`);
  console.log(`Total: ${allQuestions.length}. Closed-form (MCQ/MULTI_SELECT/TRUE_FALSE/NUMERICAL): ${closedForm} (${(100 - practicalPct).toFixed(1)}%).`);
  console.log(`Practical/scenario/analytical: ${practicalPct.toFixed(1)}% (target >= 70%).`);
  if (practicalPct < 65) {
    console.warn('WARNING: practical-question share is below target — consider authoring more scenario-based content.');
  }

  console.log(`\nTOTAL QUESTIONS: ${allQuestions.length}`);
  console.log(hardErrors === 0 ? '\nValidation PASSED.' : `\nValidation FAILED with ${hardErrors} error group(s).`);
  process.exit(hardErrors === 0 ? 0 : 1);
}

main();
