#!/usr/bin/env python3
"""Create clearly labeled review queues from existing per-kanji exports.

This generator does not approve a word or validate the saved reading map. The
exports predate the mapping audit, so every generated proposal is marked as
automated and requires exact SQLite lookup plus human linguistic review.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def hira(text):
    return "".join(chr(ord(ch) - 96) if "ァ" <= ch <= "ヶ" else ch for ch in text)


def candidate_order(item):
    row = item.get("candidate", item)
    ranks = row.get("ranks", row.get("sourceRanks", [])) or []
    return (
        0 if row.get("handwriting_tier") == "preferred" else 1,
        0 if row.get("common", row.get("commonForm", False)) else 1,
        -sum(rank is not None for rank in ranks),
        min((rank for rank in ranks if rank is not None), default=10**12),
        len(row.get("form", "")), row.get("id", 0),
    )


def read_record(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    character = data["character"]
    proposal_by_reading = []
    for reading in sorted(data.get("readings", []), key=lambda r: (
            0 if r.get("official") else 1,
            {"preferred": 0, "secondary": 1, "reference-only": 2}.get(r.get("category"), 3),
            r.get("reading", ""))):
        if not reading.get("official"):
            continue
        target = hira(reading["reading"])
        proposals = []
        for key in reading.get("candidates", []):
            row = data.get("candidates", {}).get(key)
            if not row or not row.get("id"):
                continue
            mapped = row.get("matched", {})
            if target not in {hira(k) for k in mapped}:
                continue
            proposals.append({"jmdictId": row["id"], "spelling": row["form"],
                              "kana": row["kana"], "englishCue": row.get("gloss", ""),
                              "senseIndices": row.get("senses", []), "pos": row.get("pos", []),
                              "flags": row.get("flags", []), "commonForm": bool(row.get("common")),
                              "sourceRanks": row.get("ranks", [None] * 4),
                              "savedMapping": mapped.get(target) or next(v for k, v in mapped.items() if hira(k) == target),
                              "mappingStatus": "legacy-export-mapping-unverified",
                              "reviewStatus": "automated-proposal; exact database and human review required"})
        proposals.sort(key=candidate_order)
        proposal_by_reading.append({
            "reading": reading["reading"], "official": True,
            "sourceCategory": reading.get("category"),
            "candidateCountInSource": len(reading.get("candidates", [])),
            "proposals": proposals,
        })
    ordered = []
    known = set()
    for reading in proposal_by_reading:
        for item in reading["proposals"]:
            key = (item["jmdictId"], item["spelling"], item["kana"])
            if key not in known:
                known.add(key)
                ordered.append((candidate_order({"candidate": {
                    "handwriting_tier": "preferred" if reading["sourceCategory"] == "preferred" else reading["sourceCategory"],
                    "common": item["commonForm"], "ranks": item["sourceRanks"],
                    "form": item["spelling"], "id": item["jmdictId"]}}), item))
    ordered.sort(key=lambda x: x[0])
    initial, later = [], []
    for _, item in ordered:
        # Output tiers are a reviewer queue only; no word is approved or finalized.
        if len(initial) < 3:
            initial.append({k: item[k] for k in ("jmdictId", "spelling", "kana", "englishCue", "reviewStatus")})
        else:
            later.append({k: item[k] for k in ("jmdictId", "spelling", "kana", "englishCue", "reviewStatus")})
    return {
        "kanji": character, "grade": data.get("grade"), "initial": initial, "later": later[:9],
        "readingProposals": proposal_by_reading,
        "reviewStatus": "automated queue only; no individual record has been human-reviewed",
        "sourceFile": path.name,
    }


def generate(source_root, grades, limit):
    output = {"version": "0.1", "purpose": "Automated higher-grade review queue; not a finalized curriculum.",
              "method": "Use source per-kanji candidate order, preserve JMdict IDs, sense indexes, source ranks and legacy mapping; require exact SQLite verification and human review.",
              "grades": {}, "records": []}
    for grade in grades:
        paths = sorted((source_root / f"grade-{grade}").glob("*.json"))
        records = [read_record(path) for path in paths]
        records = [record for record in records if record["grade"] == grade]
        output["grades"][str(grade)] = {"recordCount": len(records), "expectedCount": {3: 200, 4: 202, 5: 193, 6: 191}[grade],
                                          "countStatus": "complete-source-set" if len(records) == {3: 200, 4: 202, 5: 193, 6: 191}[grade] else "incomplete-source-set"}
        output["records"].extend(records[:limit] if limit else records)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path, help="consolidation/kanji directory")
    parser.add_argument("output", type=Path)
    parser.add_argument("--grades", nargs="+", type=int, default=[3, 4, 5, 6], choices=[3, 4, 5, 6])
    parser.add_argument("--limit", type=int, help="optional per-grade record limit for a pilot")
    args = parser.parse_args()
    result = generate(args.source_root, args.grades, args.limit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
