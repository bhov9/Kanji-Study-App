#!/usr/bin/env python3
"""Read-only exact-form verification for provisional kanji shortlists.

The database is opened with SQLite's mode=ro. A candidate is never approved by
this tool: output distinguishes unique exact form matches from ambiguous and
missing matches, and keeps sense, spelling, reading, segmentation, and evidence
scopes visible for human review.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from urllib.parse import quote


def _json(value, default):
    if value is None:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def _sense_summary(word, indices):
    result = []
    for index in indices:
        if not isinstance(index, int) or not 0 <= index < len(word.get("sense", [])):
            continue
        sense = word["sense"][index]
        glosses = [g.get("text", "") for g in sense.get("gloss", []) if g.get("lang") == "eng"]
        result.append({
            "index": index,
            "partOfSpeech": sense.get("partOfSpeech", []),
            "glosses": glosses,
            "misc": sense.get("misc", []),
            "appliesToKanji": sense.get("appliesToKanji", []),
            "appliesToKana": sense.get("appliesToKana", []),
        })
    return result


def _candidate_rows(conn, spelling, reading):
    rows = conn.execute(
        "SELECT id,spelling,reading,sense_indices,common FROM form "
        "WHERE spelling=? AND reading=? ORDER BY id", (spelling, reading)
    ).fetchall()
    matches = []
    for ident, text, kana, raw_indices, common in rows:
        entry = conn.execute("SELECT dictionary_json FROM entry WHERE id=?", (ident,)).fetchone()
        if not entry:
            continue
        word = _json(entry[0], {})
        senses = _json(raw_indices, [])
        matches.append({
            "jmdictId": ident,
            "spelling": text,
            "reading": kana,
            "commonForm": bool(common),
            "senseIndices": senses,
            "senses": _sense_summary(word, senses),
            "kanjiForms": [{"text": f.get("text"), "tags": f.get("tags", [])}
                           for f in word.get("kanji", []) if f.get("text") == text],
            "kanaForms": [{"text": f.get("text"), "tags": f.get("tags", []),
                           "appliesToKanji": f.get("appliesToKanji", [])}
                           for f in word.get("kana", []) if f.get("text") == kana],
        })

    owners = [r[0] for r in conn.execute(
        "SELECT DISTINCT id FROM form WHERE spelling=? ORDER BY id", (spelling,)
    )]
    pair_owners = [r[0] for r in conn.execute(
        "SELECT DISTINCT id FROM form WHERE spelling=? AND reading=? ORDER BY id", (spelling, reading)
    )]
    evidence = []
    for source, ev_reading, rank, metadata in conn.execute(
        "SELECT source,reading,rank,metadata FROM evidence "
        "WHERE spelling=? AND (reading='' OR reading=?) ORDER BY source,rank",
        (spelling, reading),
    ):
        scope = "spelling" if ev_reading == "" else "form-pair"
        eligible_ids = owners if scope == "spelling" else pair_owners
        evidence.append({
            "source": source,
            "rank": rank,
            "scope": scope,
            "identityStatus": "unique-owner" if len(eligible_ids) == 1 else "ambiguous-owner",
            "possibleJmdictIds": eligible_ids,
            "metadata": _json(metadata, None),
        })
    segments = [_json(row[0], None) for row in conn.execute(
        "SELECT segments FROM segmentation WHERE spelling=? AND reading=?", (spelling, reading)
    )]
    if len(matches) == 1:
        status = "unique-exact-match-review-required"
    elif len(matches) > 1:
        status = "ambiguous-exact-match-review-required"
    else:
        status = "no-exact-match"
    return {
        "status": status,
        "candidate": {"spelling": spelling, "reading": reading},
        "matches": matches,
        "spellingOwnerIds": owners,
        "formPairOwnerIds": pair_owners,
        "frequencyEvidence": evidence,
        "segmentations": segments,
    }


def _iter_shortlist(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    for record in data.get("records", []):
        for tier in ("initial", "later"):
            for position, item in enumerate(record.get(tier, []), 1):
                yield record, tier, position, item


def verify(database: Path, shortlist_paths: list[Path]):
    uri = "file:" + quote(str(database.resolve()), safe="/") + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.execute("PRAGMA query_only=ON")
    try:
        report = {
            "schema": "kanji-shortlist-verification-v0.1",
            "database": database.name,
            "sourceShortlists": [p.name for p in shortlist_paths],
            "policy": "exact matching is evidence only; no candidate is auto-approved",
            "records": [],
        }
        for path in shortlist_paths:
            for record, tier, position, item in _iter_shortlist(path):
                result = _candidate_rows(conn, item["spelling"], item["kana"])
                report["records"].append({
                    "kanji": record.get("kanji"),
                    "grade": record.get("grade"),
                    "tier": tier,
                    "position": position,
                    **result,
                })
        return report
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path, help="research SQLite database; opened read-only")
    parser.add_argument("shortlists", nargs="+", type=Path, help="one or more shortlist JSON files")
    parser.add_argument("-o", "--output", type=Path, help="write JSON here; default stdout")
    args = parser.parse_args()
    report = json.dumps(verify(args.database, args.shortlists), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(report, encoding="utf-8")
    else:
        print(report, end="")


if __name__ == "__main__":
    main()
