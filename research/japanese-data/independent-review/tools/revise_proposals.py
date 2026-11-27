"""Build slim v0.2 proposal queues and audit them against the local read-only DB."""
import json
import sqlite3
import subprocess
from collections import Counter
from functools import lru_cache
from pathlib import Path

from reading_mapping import hiragana
from verify_shortlists import _candidate_rows

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
BRANCH = "research/japanese-data-acquisition"

# Spelling AND pronunciation identify the review decision. Indices are zero-based.
CHOICES = {
    ("正す", "ただす"): (1376630, 0, "to correct; to set right"),
    ("元", "もと"): (1260670, 0, "origin; source"),
    ("鏡", "かがみ"): (1238550, 0, "mirror"),
    ("妻", "つま"): (1294330, 0, "wife"),
    ("素性", "そせい"): (1397290, 1, "identity; background"),
    ("解かす", "とかす"): (1546040, 0, "to melt a solid"),
    ("解ける", "とける"): (1198910, 0, "to be solved (a problem)"),
    ("位", "くらい"): (1155400, 2, "rank in society"),
    ("路上", "ろじょう"): (1612340, 0, "on the street"),
    ("共同", "きょうどう"): (1591660, 0, "cooperation"),
    ("統一", "とういつ"): (1449670, 0, "unity"),
    ("同盟", "どうめい"): (1599290, 0, "alliance"),
}
REFERENCE = {("京阪", "けいはん"), ("命", "みこと"), ("固め", "かため"), ("開けたて", "あけたて")}


def mapping(character, target, spelling, kana, variants, dictionary):
    if not target:
        return "no reading proposed"
    if not variants:
        return "missing segmentation"
    for parts in variants:
        if not parts or "".join(p["ruby"] for p in parts) != spelling or hiragana(
            "".join(p.get("rt", p["ruby"]) for p in parts)
        ) != hiragana(kana):
            return "segmentation does not reproduce form"
        indices = [i for i, p in enumerate(parts) if p["ruby"] == character]
        if spelling.count(character) != 1 or len(indices) != 1:
            return "target character not uniquely segmented"
        i = indices[0]
        actual = hiragana(parts[i].get("rt", ""))
        following = ""
        for part in parts[i+1:]:
            if "rt" in part or not all("ぁ" <= c <= "ゖ" for c in hiragana(part["ruby"])):
                break
            following += hiragana(part["ruby"])
        # Preserve on/kun notation and require the entire adjacent literal kana run.
        hits = {v for v in dictionary["on"] if v == target and hiragana(v) == actual and not following}
        for kun in dictionary["kun"]:
            value = kun["sourceNotation"]
            stem, _, ending = value.partition(".")
            if value.replace(".", "") == target and stem == actual and ending == following:
                hits.add(value)
        if len(hits) != 1:
            return "no unique exact dictionary stem and complete okurigana"
    return "supported"


def revise(item, lookup, seen, available=()):
    pair = item["spelling"], item["kana"]
    row = {k: item[k] for k in ("spelling", "kana", "englishCue", "jmdictId") if k in item}
    row.update(reviewStatus="automated proposal", disposition="proposal")
    if pair == ("千人", "せんにん"):
        return dict(spelling=pair[0], kana=pair[1], projectId="count-sennin-1000-people",
                    englishCue="one thousand people", disposition="authored counting expression",
                    reviewStatus="automated proposal")
    if pair in CHOICES:
        ident, sense, cue = CHOICES[pair]
        match = next(m for m in lookup["matches"] if int(m["jmdictId"]) == ident)
        if sense not in match["senseIndices"]:
            raise ValueError((pair, ident, sense))
        if pair in seen or (ident in available and item.get("jmdictId") != ident):
            row["disposition"] = "reference only (duplicate or alternate sense)"
        else:
            row.update(jmdictId=ident, senseIndex=sense, englishCue=cue)
            seen.add(pair)
    if pair in REFERENCE:
        row["disposition"] = "reference only (context or complete form required)"
    return row


def save(path, data):
    branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()
    if branch != BRANCH:
        raise RuntimeError(branch)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main():
    db = ROOT.parent / "local/curriculum-research.sqlite"
    conn = sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True)
    conn.execute("PRAGMA query_only=ON")
    lookup = lru_cache(None)(lambda spelling, kana: _candidate_rows(conn, spelling, kana))
    totals = {}
    for grade in range(1, 7):
        source = (ROOT / f"grade-{grade}-shortlist-v0.1.json" if grade <= 2 else
                  OUT / f"grade-{grade}-review-queue-v0.1.json")
        records = []
        counts = Counter(dict(unique=0, ambiguous=0, missing=0, mappingSupported=0,
                              mappingUnresolved=0, noTarget=0))
        for original in json.loads(source.read_text("utf-8"))["records"]:
            char = original["kanji"]
            dictionary = json.loads((ROOT.parent / f"consolidation/kanji/grade-{grade}/{char}.json").read_text("utf-8"))
            record = dict(grade=grade, kanji=char, readingProposals=[])
            groups = [(tier, None, original[tier]) for tier in ("initial", "later")]
            groups.extend(("readingProposals", g["reading"], g["proposals"]) for g in original.get("readingProposals", []))
            lexical_seen = set()
            for tier, target, items in groups:
                seen = set() if target else lexical_seen
                rows = []
                for item in items:
                    evidence = lookup(item["spelling"], item["kana"])
                    available = {other.get("jmdictId") for other in items
                                 if (other["spelling"], other["kana"]) == (item["spelling"], item["kana"])}
                    row = revise(item, evidence, seen, available)
                    # Verify the revised form, including independently authored expressions.
                    checked = lookup(row["spelling"], row["kana"])
                    ids = checked["formPairOwnerIds"]
                    status = "missing" if not ids else "unique" if len(ids) == 1 else "ambiguous"
                    counts[status] += 1
                    if "jmdictId" in row and row["jmdictId"] not in ids:
                        raise ValueError(row)
                    row.update(exactForm=status, candidateIds=ids)
                    reason = mapping(char, target, row["spelling"], row["kana"], checked["segmentations"], dictionary)
                    row["readingMapping"] = reason
                    row["eligibleReadingEvidence"] = reason == "supported" and row["disposition"] == "proposal"
                    counts["noTarget" if not target else "mappingSupported" if reason == "supported" else "mappingUnresolved"] += 1
                    rows.append(row)
                if target:
                    record[tier].append(dict(reading=target, proposals=rows))
                else:
                    record[tier] = rows
            records.append(record)
        save(OUT / f"grade-{grade}-proposals-v0.2.json",
             dict(version="0.2", source=source.name, records=records))
        totals[grade] = dict(counts)
        print(grade, dict(counts))
    save(OUT / "proposal-verification-v0.2.json", totals)
    conn.close()


if __name__ == "__main__":
    main()
