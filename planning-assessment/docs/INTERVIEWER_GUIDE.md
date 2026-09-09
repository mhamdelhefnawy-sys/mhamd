# Interviewer Guide

## Setting up an interview (`/interview/new`, §25)
Choose the candidate, their target position, project type, experience
level, planned duration, question count, and (optionally) which
competencies to focus on. This creates a structured interview backed by a
real `Assessment` (mode `INTERVIEW`) with a fixed, weighted set of
questions drawn from the question bank.

## Running the console (`/interview/[id]`, §25-27)
- The left panel lists every question in the interview with a live status
  dot (grey = not yet scored, amber = presented, green = scored).
- Click a question to view it. **"Show Answer Key & Rubric"** reveals the
  expected/strong/expert answers and full explanation — visible to you, not
  to the candidate.
- Summarize what the candidate said in **"Candidate's Answer"**.
- Score using the question's rubric sliders (0-5 per dimension) if one
  exists, or an override 0-100 score otherwise. You can always type a
  direct override score regardless of the rubric.
- **Follow-up engine** (§26): every question can carry 2-4 authored
  follow-up prompts (e.g. *"What would you check first?"*, *"Would this
  necessarily mean the project is delayed?"*) — click one to load it, record
  the candidate's response and a score, and it's logged to the interview's
  follow-up history.
- **Skip** marks a question skipped with a 0 score and moves on; you can
  return to any question at any time by clicking it in the left list — there
  is no forced linear order.
- General notes (not tied to a specific question) go in the right-hand
  **Interview Notes** panel.
- **Complete Interview** finalizes scoring exactly like a self-serve
  assessment: competency roll-up, overall score, and recommended level are
  computed the same way, so interview results are directly comparable to
  self-serve assessment results.

## After the interview
From the resulting assessment page, **Generate Report** produces the full
candidate report (competency matrix, strengths/weaknesses, red flags,
interviewer notes, final recommendation) with PDF export.
