# Question Authoring Guide (Content Schema v1)

You are writing REAL, professionally accurate questions for the seed question
bank of the **Planning Engineer Competency Assessment Platform** — a system
that evaluates Planning / Primavera P6 / Project Controls professionals from
Junior Planning Engineer up to Planning Manager / Project Controls Manager.
This is not a trivia quiz. Every question must be able to distinguish a weak
candidate from a competent, strong, senior, or expert one.

## Hard rules

1. **No placeholder content whatsoever.** No "Lorem ipsum", no "Sample
   Question", no "Dummy", no filler. Every question must be something a real
   interviewer / assessment author would actually ask a planning engineer.
2. **No duplicates or trivial rewrites.** Do not write the same question
   twice with different wording. Vary the underlying construction context
   (buildings, roads, oil & gas, infrastructure, MEP, fit-out, marine,
   power plants, data centers, etc.), the numbers, and the angle of attack.
3. **Technical accuracy is non-negotiable.** CPM math must be correct. P6
   behavior described must be real P6 behavior (P6 = Oracle Primavera P6
   EPPM/Professional), not invented. EVM formulas must be standard (PMI
   definitions). Delay-analysis and claims content must distinguish
   **technical schedule analysis** from **contractual entitlement** — never
   assume a schedule delay automatically creates entitlement; state that
   entitlement depends on contract terms, notice provisions, and causation,
   and where more than one defensible answer exists (methodology or contract
   dependent), say so explicitly and describe the acceptable range of answers.
4. **≥70% of your questions must be practical/scenario/analytical/
   troubleshooting/decision-making**, not term-recall trivia. Favor question
   types like SCENARIO, TROUBLESHOOTING, CASE_STUDY, P6_ANALYSIS,
   DECISION_MAKING, WHAT_CHECK_FIRST, IS_THIS_POSSIBLE, MOST_LIKELY_CAUSE,
   WHAT_NEXT, MISSING_INFO, PARADOX, PRACTICAL_SCENARIO,
   DELAY_CLAIM_SCENARIO, MANAGEMENT_SCENARIO over plain MCQ recall.
5. **Every question needs a real difficulty level (1-5) and primary career
   level**, and the reasoning demanded must actually match that difficulty —
   Level 5 is hard because of judgment/interpretation/commercial or
   contractual awareness, not because of obscure vocabulary.
6. Output **strict JSON only** (a single JSON array), UTF-8, valid syntax
   (no trailing commas, no comments, no markdown fences in the actual file).
   Write the array to the exact file path you were given. Do not truncate —
   if you are running low on room, finish the current question object
   cleanly and stop the array there rather than emitting invalid JSON.

## Field reference

Every question object has these fields (omit a field entirely — do not emit
`null` — when it does not apply, except where marked "always required"):

| Field | Type | Notes |
|---|---|---|
| `questionCode` | string, **always required, must be globally unique** | Use exactly the prefix and numbering scheme you were assigned, e.g. `CPM-014`. |
| `category` | string, **always required** | One of the category codes you were assigned (see your task prompt). |
| `subcategory` | string, **always required** | A specific topic within the category, e.g. `"Negative Float"`, `"Retained Logic"`, `"Concurrent Delay"`. |
| `competency` | string, **always required** | The competency GROUP code this question rolls up into for weighted scoring — you were told which group code(s) your categories map to. One of: `PLANNING_CPM`, `P6`, `SCHEDULE_ANALYSIS`, `PROJECT_CONTROLS_EVM`, `DELAY_CLAIMS`, `CONSTRUCTION_METHODOLOGY`, `ANALYTICAL_THINKING`, `MANAGEMENT_COMM_ETHICS`. |
| `skill` | string, **always required** | The precise micro-skill being tested, one specific sentence, e.g. `"Distinguishing baseline slippage from current-schedule critical delay"`. |
| `difficulty` | integer 1-5, **always required** | 1=Basic, 2=Intermediate, 3=Advanced, 4=Senior, 5=Expert/Managerial. |
| `careerLevel` | string, **always required** | Primary target level: `JUNIOR`, `PLANNING_ENGINEER`, `SENIOR`, `LEAD`, `MANAGER`. |
| `secondaryCareerLevels` | string[] | Other levels this also suits, if any. |
| `questionType` | string, **always required** | One of: `MCQ`, `MULTI_SELECT`, `TRUE_FALSE`, `NUMERICAL`, `SCENARIO`, `TROUBLESHOOTING`, `WRITTEN`, `CASE_STUDY`, `P6_ANALYSIS`, `INTERVIEW`, `DECISION_MAKING`, `WHAT_CHECK_FIRST`, `IS_THIS_POSSIBLE`, `MOST_LIKELY_CAUSE`, `WHAT_NEXT`, `MISSING_INFO`, `PARADOX`, `PRACTICAL_SCENARIO`, `DELAY_CLAIM_SCENARIO`, `MANAGEMENT_SCENARIO`. |
| `scenario` | string | The situational setup/context paragraph, when the question is scenario-based. Put project facts here, the actual question in `question`. |
| `question` | string, **always required** | The question stem/prompt itself. |
| `options` | array of `{label, text, isCorrect}` | **Required for `MCQ`/`MULTI_SELECT`/`TRUE_FALSE`.** 4-5 options for MCQ (exactly one `isCorrect:true`); 2 for TRUE_FALSE (`"True"`/`"False"`); 4-6 for MULTI_SELECT (2+ correct). Every distractor must be *plausible* — something a weak-to-competent candidate could genuinely believe — never a joke option. |
| `correctAnswer` | string \| string[] \| number \| boolean | **Required for auto-scored types** (`MCQ`,`MULTI_SELECT`,`TRUE_FALSE`,`NUMERICAL`). For MCQ/TRUE_FALSE: the correct option's `label`. For MULTI_SELECT: array of correct `label`s. For NUMERICAL: the correct numeric value (and show the calculation in `reasoning`). |
| `expectedAnswer` | string | For open-ended types: what a **competent** candidate should say (baseline pass). |
| `strongAnswer` | string | What a **strong** candidate adds beyond expectedAnswer. |
| `expertAnswer` | string | What an **expert/senior** candidate additionally demonstrates (judgment, contractual/commercial awareness, second-order consequences). |
| `explanation` | string, **always required** | The full correct-answer explanation shown in Training Mode. |
| `reasoning` | string, **always required** | The underlying logic / calculation / cause-effect chain — this is what actually teaches the concept. |
| `commonMistakes` | string[] | Specific wrong beliefs/errors weak candidates exhibit on this exact question. |
| `redFlags` | string[] | Answer patterns that should worry an interviewer (e.g., "claims full EOT entitlement without checking concurrency"). |
| `p6Checks` | string[] | For P6-relevant questions: concrete steps/fields/views a candidate should check in P6 (e.g., "Activities view → Total Float column", "Tools → Schedule → check Retained Logic vs Progress Override"). Omit if not P6-relevant. |
| `followUpQuestions` | array of `{trigger, prompt, purpose}` | 2-4 deeper follow-ups. `trigger` ∈ `"if_correct"`,`"if_partial"`,`"if_incorrect"`,`"always"`. `purpose` = one line on what it exposes. This is the interview follow-up engine's content — make these genuinely probing, in the style of "What would you check first?" / "What if there is no constraint?" / "Would this necessarily mean X?" |
| `scoringRubric` | object `{dimensions:[{name,maxScore,guidance}], passingScore}` | **Required for open-ended types** (`WRITTEN`,`SCENARIO`,`TROUBLESHOOTING`,`CASE_STUDY`,`P6_ANALYSIS`,`INTERVIEW`,`DECISION_MAKING`,`WHAT_CHECK_FIRST`,`IS_THIS_POSSIBLE`,`MOST_LIKELY_CAUSE`,`WHAT_NEXT`,`MISSING_INFO`,`PARADOX`,`PRACTICAL_SCENARIO`,`DELAY_CLAIM_SCENARIO`,`MANAGEMENT_SCENARIO`). Pick 3-5 *relevant* dimensions per question from: `technicalAccuracy`, `reasoning`, `completeness`, `practicalApplication`, `p6Understanding`, `causeAndEffect`, `professionalJudgment` (maxScore 5 each). `passingScore` = the minimum total that counts as "competent". |
| `weight` | number | Relative scoring weight, default 1.0; use 1.5-2.0 for especially discriminating Level 4-5 questions. |
| `estimatedTimeSec` | integer | Realistic time budget: MCQ/TRUE_FALSE ≈ 45-90s, NUMERICAL ≈ 90-180s, SCENARIO/WRITTEN/CASE_STUDY ≈ 150-300s, PARADOX/MANAGEMENT_SCENARIO ≈ 120-240s. |
| `tags` | string[] | 3-6 searchable keywords (P6 feature names, concepts). |
| `references` | string[] | Real, generic references only, e.g. `"PMI Practice Standard for Scheduling"`, `"AACE RP 29R-03 Forensic Schedule Analysis"`, `"SCL Delay and Disruption Protocol"`, `"PMBOK Guide"`. Do not invent fake standards. Omit if none apply. |
| `projectType`, `projectSituation`, `givenData`, `requiredAnalysis`, `expectedDecision`, `acceptableAlternativeAnswers` | see below | Only for scenario-flavored questions where useful; omit otherwise. |

### Scenario-question extension fields (optional, use when they add real value)
- `projectType`: e.g. `"High-rise residential"`, `"Highway infrastructure"`, `"Oil & gas EPC"`.
- `projectSituation`: current state of the project when the scenario occurs.
- `givenData`: object of concrete data points the candidate is given (dates, floats, %, costs).
- `requiredAnalysis`: what analysis the candidate must perform.
- `expectedDecision`: the decision/recommendation a competent candidate reaches.
- `acceptableAlternativeAnswers`: string[] — other defensible answers depending on assumptions/contract/methodology, each with the assumption that makes it valid.

## Anti-memorization

Where a question involves numbers (float, dates, EVM, durations), invent your
own realistic numbers per question — do not reuse the exact numbers from the
examples below. The platform's assessment engine will further randomize
numeric variants at runtime, but your seed data itself must already show
varied, realistic numbers across questions, not a repeated template.

## Worked examples (format only — do not reuse verbatim)

```json
[
  {
    "questionCode": "CPM-014",
    "category": "CPM",
    "subcategory": "Negative Float",
    "competency": "PLANNING_CPM",
    "skill": "Reconciling activity-level negative float with project-level negative float",
    "difficulty": 4,
    "careerLevel": "SENIOR",
    "secondaryCareerLevels": ["LEAD"],
    "questionType": "PARADOX",
    "scenario": "After a schedule update, the project-level Total Float shown in the status bar is -20 days (the project must finish 20 days late relative to the imposed finish constraint). One specific activity, 'Structural Steel Erection – Zone C', shows Total Float of -45 days.",
    "question": "Explain how an individual activity's Total Float can be more negative than the project's overall Total Float. What would you check first to confirm your explanation?",
    "explanation": "Total Float is calculated per path relative to whatever constrains that path's late dates. When multiple paths converge on different constraints (e.g., an interim milestone with its own imposed finish date, or a different calendar), an activity can sit on a path that is driven by a tighter constraint than the one driving the overall project finish, producing more negative float locally than the -20 days seen at project level.",
    "reasoning": "Backward pass late dates are seeded from constraints. If Zone C's path backward-passes from an interim 'Must Finish By' milestone that is itself already 25 days behind where the forward pass places it, that path's float = (that milestone's constraint slack) which can be more negative than the path driving the project finish. The two numbers are not required to match because they can be driven by different constraints or different calendars.",
    "commonMistakes": ["Assuming Total Float must be identical for every activity on a critical/near-critical path.", "Assuming a data-entry error rather than checking constraints first.", "Concluding the project is only 20 days late everywhere."],
    "redFlags": ["Candidate cannot explain multiple-constraint float divergence at all.", "Candidate insists this is always a scheduling error."],
    "p6Checks": ["Check the activity's driving relationship and trace its longest path back to its governing constraint.", "Check for a Mandatory/Finish-On-or-Before constraint or a Primary/Secondary constraint on an interim milestone in that path.", "Check whether Zone C activities are on a different calendar with less available working time before the constraint date."],
    "followUpQuestions": [
      {"trigger": "if_correct", "prompt": "What if there is no constraint anywhere on that path — what else could explain it?", "purpose": "Tests whether the candidate knows calendar differences and multiple-float-path convergence, not just constraints."},
      {"trigger": "always", "prompt": "Does the -45 days on this one activity mean the project itself is actually 45 days delayed?", "purpose": "Tests whether the candidate conflates activity-level float with overall project delay — a classic trap."},
      {"trigger": "if_incorrect", "prompt": "If Total Float is calculated per path, what does that tell you about comparing float values across different activities?", "purpose": "Remedial prompt toward the core concept."}
    ],
    "scoringRubric": {"dimensions": [{"name": "technicalAccuracy", "maxScore": 5, "guidance": "Correctly identifies constraint/calendar divergence as the cause."}, {"name": "reasoning", "maxScore": 5, "guidance": "Explains the backward-pass mechanics, not just states the conclusion."}, {"name": "practicalApplication", "maxScore": 5, "guidance": "Names concrete P6 checks to confirm."}], "passingScore": 9},
    "weight": 1.5,
    "estimatedTimeSec": 180,
    "tags": ["negative float", "total float", "constraints", "backward pass", "critical path"],
    "references": ["PMI Practice Standard for Scheduling"]
  },
  {
    "questionCode": "EVM-007",
    "category": "EVM",
    "subcategory": "SPI vs Completion Date",
    "competency": "PROJECT_CONTROLS_EVM",
    "skill": "Explaining SPI/schedule-date contradictions caused by float consumption vs earned-value volume",
    "difficulty": 4,
    "careerLevel": "SENIOR",
    "questionType": "NUMERICAL",
    "scenario": "At data date, PV = $8,000,000 and EV = $8,400,000, giving SPI = 1.05. Despite this, the CPM-calculated forecast finish date has slipped 15 days behind the baseline finish.",
    "question": "Calculate SPI from the figures given, then explain why a project can show SPI > 1 while its CPM forecast finish is delayed. Is the schedule performance actually favorable?",
    "correctAnswer": 1.05,
    "explanation": "SPI = EV / PV = 8,400,000 / 8,000,000 = 1.05. SPI is a cost-weighted volume-of-work metric, not a critical-path date metric: it can read favorably because high-value, high-float non-critical work was executed ahead of plan while low-value critical-path activities slipped. SPI > 1 does not guarantee the finish date is on track.",
    "reasoning": "EVM measures earned value in dollars (or budgeted units) irrespective of which activities that value sits on. A project can overachieve on float-rich, high-budget scope while under-performing on low-budget, zero-float, schedule-driving scope. Only a CPM schedule (or an EVM analysis performed strictly on critical-path activities) reveals date impact; blended SPI cannot.", 
    "commonMistakes": ["Reporting SPI=1.05 as proof the project is ahead of schedule.", "Not cross-checking SPI against the CPM critical path."],
    "redFlags": ["Uses SPI alone to override a CPM forecast without reconciling the two."],
    "followUpQuestions": [
      {"trigger": "always", "prompt": "What additional metric or analysis would you run to reconcile the two signals?", "purpose": "Tests knowledge of critical-path-only EVM / schedule variance in time reconciliation."}
    ],
    "scoringRubric": {"dimensions": [{"name": "technicalAccuracy", "maxScore": 5, "guidance": "Correct SPI calculation."}, {"name": "causeAndEffect", "maxScore": 5, "guidance": "Explains the volume-vs-critical-path distinction."}], "passingScore": 7},
    "estimatedTimeSec": 150,
    "tags": ["SPI", "EVM", "critical path", "forecast"],
    "references": ["PMBOK Guide"]
  }
]
```

## Category → competency group map (use exactly)

- PF, CPM, SLR, CONST → `PLANNING_CPM`
- P6F, P6A, CAL → `P6`
- PU, BSC, SQ → `SCHEDULE_ANALYSIS`
- RES, CL, EVM, PMH, PC → `PROJECT_CONTROLS_EVM`
- RA, DA, EOT, TIA, CO → `DELAY_CLAIMS`
- CM → `CONSTRUCTION_METHODOLOGY`
- RISK, PARA → `ANALYTICAL_THINKING`
- RPT, ETH → `MANAGEMENT_COMM_ETHICS`

## Distribution targets within your batch

For each category you are assigned, roughly follow across your questions in
that category (does not need to be exact, use judgment):
- Difficulty: ~15% L1, ~25% L2, ~30% L3, ~20% L4, ~10% L5.
- Career level: spread across JUNIOR..MANAGER, weighted toward the
  category's natural level (e.g. Calendars skews Junior/PE; EOT/Claims and
  Management scenarios skew Senior/Lead/Manager).
- Question type: at most 30% plain MCQ/TRUE_FALSE/NUMERICAL combined; the
  rest scenario/analytical/troubleshooting/decision/paradox-style types.
