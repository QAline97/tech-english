"""Validate the app's content files (data/*.json).

Checks that every item has the required fields, that ids are unique,
and that quiz answers are not repeated among the wrong options.

Usage:
    python scripts/validate_content.py
"""

import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

REQUIRED_FIELDS = {
    "vocabulary.json": ["id", "category", "term", "translation", "example", "exampleTranslation"],
    "messages.json": ["id", "level", "message", "answer", "distractors", "keywords"],
    "phrases.json": ["id", "situation", "context", "answer", "distractors", "translation"],
}

ALLOWED_VALUES = {
    "category": {"work", "communication", "data", "problems"},
    "level": {"error", "warning", "info"},
    "situation": {"daily", "chat", "meeting", "email"},
}

MIN_DISTRACTORS = 2


def validate_item(item: dict, fields: list[str]) -> list[str]:
    errors = []

    for field in fields:
        value = item.get(field)
        if value is None or value == "" or value == []:
            errors.append(f"missing field '{field}'")

    for field, allowed in ALLOWED_VALUES.items():
        if field in item and item[field] not in allowed:
            errors.append(f"invalid {field} '{item[field]}' (allowed: {sorted(allowed)})")

    distractors = item.get("distractors")
    if distractors is not None:
        if len(distractors) < MIN_DISTRACTORS:
            errors.append(f"needs at least {MIN_DISTRACTORS} distractors")
        if item.get("answer") in distractors:
            errors.append("answer is repeated in distractors")
        if len(set(distractors)) != len(distractors):
            errors.append("distractors have duplicates")

    return errors


def main() -> int:
    seen_ids: set[str] = set()
    total_errors = 0

    for filename, fields in REQUIRED_FIELDS.items():
        path = DATA_DIR / filename
        try:
            items = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"[ERROR] {filename}: could not read file ({exc})")
            total_errors += 1
            continue

        for position, item in enumerate(items, start=1):
            label = item.get("id", f"item #{position}")
            errors = validate_item(item, fields)

            if label in seen_ids:
                errors.append("duplicated id")
            seen_ids.add(label)

            for error in errors:
                print(f"[ERROR] {filename} -> {label}: {error}")
            total_errors += len(errors)

        print(f"[OK] {filename}: {len(items)} items checked")

    if total_errors:
        print(f"\nFound {total_errors} error(s).")
        return 1

    print("\nAll content is valid!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
