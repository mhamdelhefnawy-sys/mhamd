# Scoring & Competency Methodology

## 1. Per-answer scoring

**Closed-form types** (`MCQ`, `MULTI_SELECT`, `TRUE_FALSE`, `NUMERICAL`) are
auto-scored against the authored `correctAnswer` (`src/lib/engine/scoring.ts
→ scoreAutoAnswer`):
- MCQ / True-False: exact match, 100 or 0.
- Multi-select: partial credit — `(correct selected − incorrect selected) /
  total correct`, clipped to 0-100. Exact-match is also recorded separately
  as `isCorrect` for pass/fail displays.
- Numerical: matched within a 2% relative tolerance (real-world EVM/float
  figures are rarely typed to the exact decimal the author used).

**Open-ended types** (`WRITTEN`, `SCENARIO`, `TROUBLESHOOTING`, `CASE_STUDY`,
`P6_ANALYSIS`, `INTERVIEW`, `DECISION_MAKING`, the "what would you check
first / is this possible / most likely cause / what next / missing info"
family, `PARADOX`, `PRACTICAL_SCENARIO`, `DELAY_CLAIM_SCENARIO`,
`MANAGEMENT_SCENARIO`) use a **rubric**: each question defines 3-5 relevant
dimensions out of `technicalAccuracy`, `reasoning`, `completeness`,
`practicalApplication`, `p6Understanding`, `causeAndEffect`,
`professionalJudgment`, each scored 0-5, summed to a 0-100 `finalScore`
against a `passingScore`.

### Who scores the rubric?
- **Interview Mode**: the interviewer scores every dimension live (or
  overrides with a single 0-100 number), sees the full answer key, and can
  add notes — this is the authoritative, human-graded path (§27).
- **Self-serve modes** (Quick/Standard/Full/Certification/Training/etc.):
  there is no human interviewer in the loop, so the platform falls back to
  `heuristicConceptScore()` — a **keyword/concept-detection heuristic**
  that checks whether the significant terms from the question's
  `expectedAnswer`/`strongAnswer`/`tags` appear in the candidate's written
  answer, and reports `detectedConcepts` / `missingConcepts` alongside a
  draft score.

**This heuristic is explicitly not "AI grading."** It is a transparent,
inspectable draft score — the UI and this document both label it as
indicative, not authoritative. A real NLP/LLM evaluator was out of scope for
this build (no model-hosting dependency was wired in), and the platform
would rather be honest about a simple heuristic than silently claim
semantic understanding it doesn't have. The architecture is ready for a
real evaluator to replace `heuristicConceptScore()` without touching
anything else — it has the same `{finalScore, detectedConcepts,
missingConcepts}` shape a smarter implementation would return, and every
place that stores a score also stores an optional `interviewerOverrideScore`
that always wins when present.

## 2. Competency roll-up (§28)

`computeAssessmentScores()` (`src/lib/engine/results.ts`) groups every
answered question's effective score by its competency, and computes:

```
overallScore = Σ(competencyAvgScore × competencyWeight) / Σ(weights of competencies actually assessed)
```

Weights live on the `Competency` table (`defaultWeight`), editable by an
Admin from **Competencies** in the UI — they must sum to 100 (enforced
server-side). A competency with zero questions answered in a given
assessment is excluded from both numerator and denominator, not silently
zeroed — an assessment that never touched EVM shouldn't be penalized as if
the candidate scored 0 on it.

## 3. Level classification (§29) — critical-competency gating

The overall score alone never determines the classification. Every
`LevelThreshold` row (admin-editable) carries both a `minOverallScore` and a
`minCriticalCompetencyScore` map for the **critical** competency groups
(Planning & CPM, Primavera P6, Schedule Analysis, Delay/Claims —
`isCritical: true` on the `Competency` table). `classifyCandidate()`
(`src/lib/engine/classification.ts`) walks the ladder from the top down and
awards the **highest** level where both the overall score AND every
critical-competency floor are cleared — a candidate who scores 90% overall
but 35% on Primavera P6 will be capped below any level whose P6 floor they
miss, however good their average looks. `gatingCompetency` in the result
tells the UI which competency is holding them back, and `gapToNextLevel`
quantifies exactly how much more is needed on each dimension.

`confidenceLevel` (LOW/MEDIUM/HIGH) is driven by how many questions were
actually answered — a 10-question quick test earns a lower confidence
label than a 60-question full assessment even at the same score.

## 4. Adaptive difficulty (§23)

`src/lib/engine/adaptive.ts` maintains a running per-competency difficulty
estimate (1-5, fractional) per assessment. After each answer:
- ≥85% score (and answered within 1.2× the estimated time): +0.75
- ≥65%: +0.25
- ≥40%: −0.25
- <40%: −0.75 (triggers an easier "diagnostic" question next)
- a 3+ streak in one direction adds a small momentum bonus/penalty

The next question for that competency is drawn from a difficulty band
around the updated estimate (±1, widening if the pool is thin), excluding
anything already asked in this assessment. Competency **coverage** is still
guaranteed independent of adaptivity — the assessment's competency
allocation plan (§28-weighted) is fixed at creation time; only each slot's
difficulty (and therefore which specific question fills it) adapts live.

## 5. Anti-memorization (§49)

Question order, option order, and (for the subset of numerical questions
with parseable `givenData`) a linear-scaled numeric variant are randomized
per presentation — see `src/lib/engine/randomization.ts` and
`questionGenerator.ts`.
