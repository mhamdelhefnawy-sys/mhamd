#!/usr/bin/env python3
"""Validate the question bank against the schema and the blueprint.

Usage: python3 tools/validate.py [--coverage]
Exit code is non-zero when any error is found; warnings do not fail.
"""
import json
import sys
from collections import Counter
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("jsonschema is required: pip install jsonschema")

ROOT = Path(__file__).resolve().parent.parent
TYPE_CODES = {
    "fundamentals": "FUN", "conceptual": "CON", "application": "APP",
    "scenario": "SCN", "troubleshooting": "TRB", "cause_effect": "CAE",
    "numerical": "NUM", "decision": "JDG", "interview_pressure": "PRS",
    "behavioral": "BHV",
}


def load_questions():
    questions = []
    for path in sorted((ROOT / "data" / "questions").glob("*.json")):
        for q in json.loads(path.read_text(encoding="utf-8")):
            questions.append((path.name, q))
    return questions


def main():
    schema = json.loads((ROOT / "schema" / "question.schema.json").read_text(encoding="utf-8"))
    blueprint = json.loads((ROOT / "data" / "blueprint.json").read_text(encoding="utf-8"))
    domains = {d["id"]: d for d in blueprint["domains"]}
    validator = Draft202012Validator(schema)
    errors, warnings = [], []

    # Blueprint must be internally consistent.
    for key, values in (("domains", [d["target"] for d in blueprint["domains"]]),
                        ("question_types", blueprint["question_types"].values()),
                        ("career_levels", blueprint["career_levels"].values())):
        if sum(values) != blueprint["target_total"]:
            errors.append(f"blueprint: {key} sum {sum(values)} != {blueprint['target_total']}")

    questions = load_questions()
    ids = Counter(q.get("id") for _, q in questions)
    all_ids = set(ids)

    for fname, q in questions:
        qid = q.get("id", "?")
        where = f"{fname}:{qid}"
        for err in validator.iter_errors(q):
            loc = "/".join(str(p) for p in err.absolute_path)
            errors.append(f"{where}: schema {loc}: {err.message}")
        if ids[qid] > 1:
            errors.append(f"{where}: duplicate id")
        domain = domains.get(q.get("domain"))
        if not domain:
            errors.append(f"{where}: unknown domain {q.get('domain')}")
            continue
        parts = qid.split("-")
        if parts[0] != domain["code"]:
            errors.append(f"{where}: id prefix {parts[0]} != domain code {domain['code']}")
        if len(parts) == 3 and parts[1] != TYPE_CODES.get(q.get("type")):
            warnings.append(f"{where}: type code {parts[1]} != expected {TYPE_CODES.get(q.get('type'))}")

        ev = q.get("evaluation", {})
        point_ids = [p["id"] for k in ("required_points", "acceptable_points", "advanced_points")
                     for p in ev.get(k, [])]
        dupes = [p for p, n in Counter(point_ids).items() if n > 1]
        if dupes:
            errors.append(f"{where}: duplicate point ids {dupes}")
        for f in q.get("follow_ups", []):
            ref = f.get("ref_point")
            if f.get("trigger") in ("if_missing", "if_mentioned") and not ref:
                errors.append(f"{where}: follow-up {f['id']} trigger {f['trigger']} needs ref_point")
            if ref and ref not in point_ids:
                errors.append(f"{where}: follow-up {f['id']} ref_point '{ref}' not defined")
        if q.get("scenario_level", 0) > 0 and "scenario" not in q and "data_table" not in q:
            warnings.append(f"{where}: scenario_level > 0 but no scenario text")
        if q.get("type") != "fundamentals" and not q.get("follow_ups"):
            warnings.append(f"{where}: non-fundamental question without follow-ups")
        for rel in q.get("related", []):
            if rel not in all_ids:
                warnings.append(f"{where}: related id {rel} not in bank yet")

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")

    print(f"\n{len(questions)} questions, {len(errors)} errors, {len(warnings)} warnings")

    if "--coverage" in sys.argv:
        per_domain = Counter(q.get("domain") for _, q in questions)
        per_type = Counter(q.get("type") for _, q in questions)
        per_level = Counter(q.get("career_level") for _, q in questions)
        print("\nDomain coverage:")
        for d in blueprint["domains"]:
            n = per_domain.get(d["id"], 0)
            print(f"  {d['id']} {d['code']} {d['name']:<38} {n:>4}/{d['target']}")
        print("\nType coverage:")
        for t, target in blueprint["question_types"].items():
            print(f"  {t:<20} {per_type.get(t, 0):>4}/{target}")
        print("\nCareer level coverage:")
        for lv, target in blueprint["career_levels"].items():
            print(f"  {lv:<20} {per_level.get(lv, 0):>4}/{target}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
