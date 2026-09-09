# Competency Methodology

This describes *what* the platform measures and *why* it's organized this
way — `docs/SCORING_METHODOLOGY.md` covers *how* the numbers are computed.

## Two layers of taxonomy, on purpose

- **25 content categories** (§3) organize the question bank the way a
  planning/project-controls team actually thinks about topics: CPM, P6
  Fundamentals, P6 Advanced, Progress Updating, EVM, Delay Analysis, EOT/
  Claims, Construction Methodology, Paradoxes & Trap Scenarios, etc.
- **8 weighted competency groups** (§28) are what the platform actually
  scores and classifies against. Every category rolls up into exactly one
  group (see the map in `content/QUESTION_SCHEMA.md` and
  `src/lib/constants.ts → CATEGORIES`), so the fine-grained content
  taxonomy and the coarse-grained scoring taxonomy never drift apart.

| Group | Default weight | Critical? | Rolls up |
|---|---|---|---|
| Planning & CPM | 20% | Yes | Planning Fundamentals, CPM/Float, Schedule Logic, Constraints |
| Primavera P6 | 20% | Yes | P6 Fundamentals, P6 Advanced, Calendars |
| Schedule Analysis | 15% | Yes | Progress Updating, Baseline/Comparison, Schedule Quality |
| Project Controls / EVM | 10% | No | Resources, Cost Loading, EVM, Productivity, Project Controls |
| Delay / Claims | 15% | Yes | Recovery/Acceleration, Delay Analysis, EOT/Claims, TIA, Change Orders |
| Construction Methodology | 10% | No | Construction Methodology |
| Analytical Thinking | 5% | No | Risk/Schedule Risk, Planning Paradoxes & Trap Scenarios |
| Management / Comm. / Ethics | 5% | No | Reporting/Management, Professional Judgment/Ethics |

## Why four groups are "critical" and four aren't

Planning & CPM, Primavera P6, Schedule Analysis, and Delay/Claims are the
groups a Planning Engineer literally cannot be senior-competent without —
they are the load-bearing technical skills the whole discipline is named
after. Project Controls/EVM, Construction Methodology, Analytical Thinking,
and Management/Ethics are important and weighted accordingly, but a
candidate can be a strong, promotable Planning Engineer while still
developing in one of those without it being disqualifying the way weak CPM
or weak P6 would be. This is a judgment call, not a law of nature — it's why
`isCritical` lives on the `Competency` table and is editable by an Admin
from `/competencies`, not hard-coded.

## Why "critical" gates classification instead of just lowering the average

A weighted average alone lets a candidate compensate for a serious technical
gap by being strong everywhere else — score 95% on Construction Methodology
and Management, 30% on Primavera P6, and the blended number can still look
like "Senior." That is exactly the failure mode §1/§29 rule out explicitly:
*"A candidate must NOT receive a Senior classification merely because of a
high total score if critical competencies are weak."* The gating logic in
`classifyCandidate()` fixes this structurally: a classification level is
only awarded if the overall score **and every critical competency's own
floor** are both cleared — see `docs/SCORING_METHODOLOGY.md §3` for the
mechanics.

## Career-level mapping vs. classification output

`careerLevel` on a `Question` (Junior / Planning Engineer / Senior / Lead /
Manager, §6) is the question's *intended primary audience* — used to build
career-appropriate assessments (e.g. Senior/Manager mode restricts to
difficulty ≥3 and career level Senior+). The platform's *output*
classification (§29) is a finer 11-point ladder (Below Junior → Project
Controls Manager) because a single assessment result needs to say more than
"suitable for a Senior" — it needs to say how far into or past that band the
candidate actually landed, which is what `nextLevel` / `gapToNextLevel` in
the classification result communicate.
