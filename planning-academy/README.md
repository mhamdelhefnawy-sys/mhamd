# Planning Engineer Interview & Project Controls Academy

> ليس بنك أسئلة، بل نظام لتقييم طريقة تفكير مهندس التخطيط واتخاذه للقرار.
> Not a question bank: a system that assesses how a planning engineer thinks and decides.

**Learn → Practice → Analyze → Simulate → Evaluate → Improve → Re-test**

## Structure

| Path | Content |
|---|---|
| `docs/question-specification.md` | Master Question Specification: rules, scoring, follow-ups, mastery, QC |
| `schema/question.schema.json` | JSON Schema every question must pass |
| `data/blueprint.json` | Target distribution: 40 domains, 10 types, 5 career levels (1,000 questions) |
| `data/questions/*.json` | The question bank (`gold-standard.json` = reference quality bar) |
| `tools/validate.py` | Validator + coverage report |

```bash
python3 tools/validate.py --coverage
```

## Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Question Architecture & Blueprint | ✅ Done (agreed in conversation) |
| 2 | Master Question Specification + schema + 10 gold-standard questions | ✅ Done |
| 3 | Question generation, domain by domain, in batches validated against the spec | ⏳ Next |
| 4 | Quality control pass (duplicates, accuracy, ambiguity, rubric quality) | — |
| 5 | Application architecture (data model, engines, UI flows) | — |
| 6 | Offline-first HTML application (Study / Practice / Exam / Interview / Reports) | — |

## Decisions log

- **Blueprint total corrected from 1,090 → 1,000.** The V1 domain table summed to 1,090. Trimmed overlapping domains (P6 EV vs EVM Analysis, Recovery vs Acceleration, Claims vs Concurrent Delay, etc.) and kept all 40 domains.
- **Built directly instead of via a copy/paste Master Prompt.** Each phase is committed to this repo, so nothing depends on one huge prompt or one chat context.
- **Two evaluation modes** (spec §5.5): offline self-assessment checklist always works; AI evaluation is optional and needs an API key. *Open decision for Phase 5:* which AI provider/key handling to support.
- **Numerical mutations are computed by code, never by the AI**, to avoid wrong engineering numbers.
