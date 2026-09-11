# HTML demo build

A single self-contained `index.html` (~3 MB, all inline — open it directly
in any browser, no server, no `npm install`) that replicates the core
candidate/assessment/scoring experience of the full Next.js platform:
take a real assessment from the full 705-question bank, get scored by the
same weighted-competency + critical-gating classification logic, and see
your competency profile — all client-side, persisted to this browser's
`localStorage`.

**Scope** (shown as a banner on the page itself): this build intentionally
does not include Interview Mode, the admin question-bank editor, PDF
export, or a real multi-user database — those require the full
`planning-assessment/` Next.js app. See the root `README.md` for that.

## Files

- `index.html` — the built, shippable file. Open it directly.
- `template.html` — the source (HTML/CSS/JS) with a `__QUESTIONS_DATA__`
  placeholder for the question bank.
- `build.js` — regenerates `index.html` by embedding every question from
  `content/questions/*.json` into `template.html`.

## Rebuilding

After editing `template.html` or growing the question bank:

```bash
node demo-html/build.js
```
