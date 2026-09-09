# Question Import / Export Guide (§34)

The question bank must be able to grow from 500+ → 1,000+ → 5,000+ without
any architecture change. Every question is a structured database row (see
`docs/DATABASE.md`); import/export is the same pipeline whether it's driven
by the seed script, the CLI, or the admin UI.

## JSON format
An array of question objects matching `content/QUESTION_SCHEMA.md` /
`src/lib/validation/questionSchema.ts`. This is the canonical, lossless
format — every field (options, rubric, follow-ups, scenario fields) round-trips.

```json
[
  {
    "questionCode": "CPM-101",
    "category": "CPM",
    "subcategory": "Negative Float",
    "competency": "PLANNING_CPM",
    "skill": "...",
    "difficulty": 4,
    "careerLevel": "SENIOR",
    "questionType": "PARADOX",
    "question": "...",
    "explanation": "...",
    "reasoning": "...",
    "scoringRubric": { "dimensions": [{ "name": "reasoning", "maxScore": 5 }], "passingScore": 3 }
  }
]
```

## CSV format
A flatter format for spreadsheet-friendly bulk editing. Structured fields
(options, correct answer, rubric) are JSON-encoded inside their own CSV
cell:

| Column | Notes |
|---|---|
| `questionCode`, `category`, `subcategory`, `competency`, `skill` | plain text |
| `difficulty` | 1-5 |
| `careerLevel`, `questionType` | must match the enum values in `src/lib/constants.ts` |
| `scenario`, `question`, `expectedAnswer`, `explanation`, `reasoning` | plain text (quote if it contains commas/newlines — standard CSV quoting) |
| `optionsJson` | e.g. `[{"label":"A","text":"...","isCorrect":true}, ...]` |
| `correctAnswerJson` | e.g. `"A"`, `["A","C"]`, or `1.05` |
| `scoringRubricJson` | e.g. `{"dimensions":[...],"passingScore":6}` |
| `tags` | comma-separated |
| `weight`, `estimatedTimeSec`, `status` | numeric / plain text |

## Where to import/export
- **Admin UI**: Question Bank → Import / Export panel — upload a file,
  pick JSON or CSV, see a per-row created/updated/error summary.
- **API**: `POST /api/questions/import` `{format, content}`,
  `GET /api/questions/export?format=json|csv[&category=CODE]`.
- **CLI**: `npm run questions:import -- path/to/file.json`.
- **Seed step**: drop new files into `content/questions/*.json` and re-run
  `npm run db:seed` — every file is validated and upserted by
  `questionCode`, so re-seeding is always safe.

## Validation
`npm run questions:validate` checks every seed file against the schema,
flags cross-file duplicate `questionCode`s, reports category coverage
against the §3 minimums, and checks the overall closed-form vs.
practical/scenario question-type balance (§4 target: ≥70% practical).
Run it before seeding a new batch of authored content.
