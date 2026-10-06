# Master Question Specification — V1.0

> المرجع الإلزامي لأي سؤال يدخل البنك. أي سؤال لا يحقق هذه المواصفة يُرفض، مهما كان عدد الأسئلة المطلوب.
> The binding reference for every question. A question that fails this spec is rejected regardless of count targets.

Machine-readable form: [`schema/question.schema.json`](../schema/question.schema.json).
Validator: `python3 tools/validate.py --coverage`.
Reference examples (quality bar): [`data/questions/gold-standard.json`](../data/questions/gold-standard.json).

---

## 1. Golden rules

1. **No question exists to fill a count.** Each question needs a defined competency objective, realistic engineering context, technically defensible answer logic and measurable evaluation criteria.
2. **No cosmetic duplicates.** Two questions that test the same concept with reworded text are one question; the second becomes a `what_if_variations` entry or a `mutation` of the first.
3. **Symptom ≠ root cause.** Any question about a symptom (negative float, SPI drop, date movement) must accept only answers that *investigate* causes, never answers that assert one cause without evidence.
4. **Scenario-dependent answers.** Where the correct answer depends on the data given, the model answer must say so and the rubric must set `scenario_dependent: true`.
5. **Multiple valid answers are allowed.** If several approaches are professionally correct, set `multiple_valid_answers: true` and the evaluator must not penalise a correct alternative.
6. **Calculation → Interpretation → Decision.** Numerical questions are never just "calculate X"; they must ask what the number means and what you would do.
7. **Technical terms stay in English** (Total Float, Data Date, Remaining Duration, Earned Value…). Arabic text explains them, it does not translate them away.

## 2. ID convention

`<DOMAIN CODE>-<TYPE CODE>-<NNN>`, for example `CPM-SCN-001`.

| Type | Code | Type | Code |
|---|---|---|---|
| fundamentals | FUN | cause_effect | CAE |
| conceptual | CON | numerical | NUM |
| application | APP | decision | JDG |
| scenario | SCN | interview_pressure | PRS |
| troubleshooting | TRB | behavioral | BHV |

Domain codes are defined in [`data/blueprint.json`](../data/blueprint.json).

## 3. Classification axes

Every question is placed on **four independent axes**:

| Axis | Values | Meaning |
|---|---|---|
| `type` | 10 types (above) | What kind of thinking the question demands |
| `career_level` | junior · planning_engineer · senior · lead · manager | Who would be asked this in a real interview |
| `bloom_level` | 1 Recall · 2 Understand · 3 Apply · 4 Analyze · 5 Diagnose · 6 Decide · 7 Defend · 8 Expert | Depth of thinking |
| `scenario_level` | 0 none · 1 single clear cause · 2 two causes · 3 many causes · 4 conflicting data · 5 real pressure & constraints | Complexity of the situation |

Consistency rules (checked during QC review):
- `fundamentals` → bloom 1–2, scenario 0.
- `troubleshooting` → bloom ≥ 5, scenario ≥ 2.
- `interview_pressure` → bloom ≥ 7.
- `manager` level → bloom ≥ 6.

## 4. Anatomy of a question

| Field | Required | Purpose |
|---|---|---|
| `scenario` / `data_table` | when scenario_level > 0 | Context the candidate must reason from |
| `question` {en, ar} | ✔ | The ask |
| `thinking_objectives` | ✔ | What the question actually measures (not the topic) |
| `model_answer.en` | ✔ | Professional English answer, interview-ready wording |
| `model_answer.ar_explanation` | ✔ | Arabic explanation of the *reasoning*, not a literal translation |
| `model_answer.calculation` | numerical | Every step, with units |
| `evaluation.required_points` | ✔ | Must appear for a passing score; each has a weight 0.5–3 |
| `evaluation.acceptable_points` | ✔ | Correct, useful, not essential |
| `evaluation.advanced_points` | ✔ | Senior-level insight; needed for 9–10 |
| `evaluation.red_flags` | ✔ | Misunderstandings, with severity minor/major/critical |
| `follow_ups` | ✔ (except fundamentals) | Interviewer probes, see §6 |
| `what_if_variations` | recommended | Changed conditions on the same scenario |
| `mutation` | recommended for scenario/numerical | Parameter ranges the engine may vary |
| `misconceptions` | ✔ | Common wrong mental models |
| `status` | ✔ | draft → reviewed → approved |

## 5. Evaluation engine (scoring)

### 5.1 Dimensions

The evaluator scores seven dimensions 0–10:

| Dimension | Weight | Asks |
|---|---|---|
| Technical Accuracy | 25% | Is what was said correct? |
| Reasoning | 20% | Is the logic sound, cause linked to effect? |
| Completeness | 15% | Coverage of required points (weighted) |
| Diagnostic Approach | 15% | Investigates before concluding, orders checks sensibly |
| Evidence | 10% | Asks for / cites the right data |
| Decision Quality | 10% | Is the recommendation appropriate and justified? |
| Communication | 5% | Clear, structured, interview-ready |

`raw = Σ(dimension × weight)`.

### 5.2 Caps (applied after the weighted score)

| Condition | Max score |
|---|---|
| Any **critical** red flag | 4 |
| Any **major** red flag | 6 |
| Weighted required-point coverage < 50% | 5 |
| Weighted required-point coverage < 80% | 7 |
| No advanced point mentioned | 8 |
| Senior/lead/manager question with < 2 advanced points | 9 |

`final = min(raw, all applicable caps)`, rounded to 0.5.

**Forbidden:** keyword scoring. Mentioning "critical path" earns nothing unless it is used correctly in the reasoning. A point counts as *covered* only when its meaning is present and correct.

### 5.3 Score bands

| Score | Band |
|---|---|
| 0–1 | Does not know |
| 2–3 | Weak |
| 4–5 | Basic |
| 6 | Acceptable |
| 7 | Good |
| 8 | Strong |
| 9 | Senior-level |
| 10 | Expert / interview-ready |

### 5.4 Feedback format (every evaluated answer)

```
Score: 6.5 / 10  (Acceptable)
Dimensions: Technical 8 · Reasoning 6 · Completeness 6 · Diagnostic 5 · Evidence 5 · Decision 7 · Communication 8
Strengths: …
Missing: … (by required point)
Red flags: … (with why it is wrong)
Better reasoning: … (short model reasoning, not the whole model answer)
Interview note: one sentence an interviewer would write about you
```

### 5.5 Two evaluation modes

- **Offline / self-assessment** — no AI. The candidate writes an answer, then sees the point checklist and ticks what they covered and which red flags they hit; caps are applied automatically. Honest but self-reported.
- **AI evaluation** — an LLM receives the question, the rubric and the answer and returns the structure in §5.4 as JSON. It must quote the part of the answer that justifies each covered point (anti-hallucination), and it may only judge against the rubric plus established engineering/P6 behaviour (see §8).

## 6. Follow-up engine

Each follow-up has a `trigger`:

| Trigger | When the interviewer asks it |
|---|---|
| `always` | After any answer |
| `if_missing` | When the referenced required/advanced point (`ref_point`) was not covered |
| `if_mentioned` | When the candidate mentioned `ref_point`, to test depth |
| `pressure` | In Stress/Pressure interview mode: challenges, "are you sure?", conflicting stakeholder |
| `what_if` | Changes one condition of the scenario |

Selection order per turn: `if_missing` (highest weight first) → `if_mentioned` → `what_if` → `pressure` (pressure mode only) → `always`. Maximum 3 follow-ups per question in Practice, 5 in Stress mode. Follow-up answers are scored with the same dimensions but against the follow-up's `expects` list.

## 7. Scenario mutation

`mutation` lists the values the engine may substitute. Rules:
- The model answer must remain valid for every combination, **or** the question must be `scenario_dependent` and the rubric written in terms of relationships ("project float less negative than activity float → look for a nearer constraint"), not fixed numbers.
- Numerical mutations are recomputed by code, never by the LLM.
- Invalid combinations (e.g., EV > BAC) are filtered out.

## 8. Technical accuracy guardrails

The bank and the AI evaluator may rely only on:
1. CPM principles (forward/backward pass, float, relationships, lags, constraints).
2. Documented Primavera P6 behaviour. If behaviour depends on a setting (float calculation, Retained Logic vs Progress Override, percent complete type, EV technique, calculation options), the answer must name the setting rather than assume a default.
3. Standard EVM definitions (PMI). Formula: `CPI = EV/AC`, `SPI = EV/PV`, `EAC = BAC/CPI` (other EAC formulas allowed when named).
4. Construction practice as commonly accepted in GCC building/infrastructure projects.
5. Contract/delay topics: principles only (notice, causation, critical path effect, evidence, concurrency approaches). No jurisdiction-specific legal conclusions; FIDIC references allowed by clause topic.

When the true answer is "it depends", the question says what it depends on.

## 9. Mastery & readiness

**Topic mastery (per sub_domain):** 0 Unknown · 1 Familiar · 2 Basic · 3 Competent · 4 Strong · 5 Interview Ready.
Level 5 requires a score ≥ 7 average, with at least 2 attempts each, across **all** of: knowledge (fundamentals/conceptual), application, scenario, troubleshooting, and follow-up answers. Pure-definition success caps mastery at 2.

**Readiness score** = weighted average of competency scores, each derived from its domains:

| Competency | Domains |
|---|---|
| Technical Knowledge | D01–D06 |
| Schedule Analysis | D07–D11, D35 |
| Primavera P6 | D14–D19, D21 |
| EVM & Cost | D20, D22, D25 |
| Resources & Productivity | D23, D24 |
| Delay & Claims | D27–D30 |
| Recovery | D12, D13 |
| Construction & Commercial | D31–D34 |
| Problem Solving & Judgment | D36, D37 |
| Communication & Leadership | D26, D38–D40 |

| Readiness | Verdict |
|---|---|
| ≥ 85% | INTERVIEW READY |
| 70–84% | READY WITH IMPROVEMENT REQUIRED |
| 55–69% | NEEDS FOCUSED TRAINING |
| < 55% | NOT READY |

Any competency below 50% is flagged as a **critical weakness** regardless of the overall score.

## 10. Quality-control checklist (Phase 4)

A reviewer (human or AI) marks a question `reviewed` only if all are true:

- [ ] Passes the validator with no errors.
- [ ] Model answer is technically correct and P6-setting-aware.
- [ ] Not a cosmetic duplicate of an existing question.
- [ ] Unambiguous: a competent planner would understand what is asked.
- [ ] Scenario is realistic (quantities, durations, roles plausible).
- [ ] Required points are necessary *and* sufficient for a 7.
- [ ] At least one red flag captures the most common wrong answer.
- [ ] Follow-ups go deeper; they don't just repeat the question.
- [ ] Arabic explains the reasoning; technical terms kept in English.
- [ ] Classification axes are consistent (§3).

`approved` additionally requires a second review by a different reviewer.
