"""Audit a pinned app snapshot and check official examples for uncovered v0.2 targets."""
import argparse
import ast
from collections import Counter
import json
import re
import sqlite3
import subprocess

from pathlib import Path
import sys

from export_linguistic_review import ROOT, kana as pronunciation


def snapshot(commit, name):
    return subprocess.check_output(["git", "show", f"{commit}:{name}"], cwd=ROOT).decode()


def deck(commit):
    starters = snapshot(commit, "data.js").split("const wordRows = ", 1)[1].split("];", 1)[0]
    grades = snapshot(commit, "grade-vocabulary.js").split("export const gradeVocabulary = ", 1)[1]
    maps = snapshot(commit, "reading-mappings.js").split("export const readingMappings = ", 1)[1]
    fallback = json.loads(re.sub(r",\s*}", "}", maps.strip().rstrip(";")))
    records = ast.literal_eval(starters + "]") + json.loads(re.sub(r",\s*];\s*$", "]", grades))
    for ident, word, kana, cue, *parts in records:
        yield ident, word, kana, cue, parts[0] if parts else fallback.get(ident)


def forms(db, word, kana, *, fold_kana=False):
    compare = "pronunciation(reading)=pronunciation(?)" if fold_kana else "reading=?"
    return db.execute("SELECT id,sense_indices,dictionary_json FROM form JOIN entry USING(id) "
                      f"WHERE spelling=? AND {compare} ORDER BY id,reading", (word, kana)).fetchall()


def segments(db, word, kana):
    return [json.loads(s) for s, in db.execute(
        "SELECT segments FROM segmentation WHERE spelling=? AND pronunciation(reading)=pronunciation(?)", (word, kana))]


def glosses(raw):
    return [g["text"] for g in raw["gloss"] if g["lang"] == "eng"]


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def audit(db, commit):
    counts = Counter()
    exceptions = []
    for ident, word, kana, cue, parts in deck(commit):
        counts["cards"] += 1
        matches = forms(db, word, kana, fold_kana=True)
        owners = sorted({m[0] for m in matches})
        selected = [m for m in matches if not ident.startswith("jmdict:") or m[0] == int(ident.split(":")[1])]
        flags = []
        alternatives = {}
        if not matches:
            flags.append("form absent in snapshot")
            alternatives["attestedReadings"] = [v for v, in db.execute(
                "SELECT DISTINCT reading FROM form WHERE spelling=?", (word,))]
        elif not selected:
            flags.append("stored ID does not own form")
        else:
            counts["exactFormAndOwner"] += 1
            cues = [norm(s) for s in cue.split(";")]
            applicable, excluded = [], []
            for _, indices, raw in selected:
                for i, s in enumerate(json.loads(raw)["sense"]):
                    (applicable if i in json.loads(indices) else excluded).append(glosses(s))
            def fits(s):
                return all(c in [norm(g) for g in s] for c in cues)
            if any(map(fits, applicable)):
                counts["cueMatchesApplicableSense"] += 1
            elif any(map(fits, excluded)):
                flags.append("cue matches excluded sense only")
            else:
                flags.append("paraphrase or cue needs comparison")
            if flags:
                alternatives["applicableGlossSamples"] = [s[:3] for s in applicable[:5]]
        if parts:
            variants = segments(db, word, kana)
            valid = [v for v in variants if "".join(x["ruby"] for x in v) == word and
                     pronunciation("".join(x.get("rt", x["ruby"]) for x in v)) == pronunciation(kana)]
            splits = []
            for variant in valid:
                split = []
                for x in variant:
                    if "rt" in x and len(x["ruby"]) != 1:
                        break
                    split.extend([x["rt"]] if "rt" in x else list(x["ruby"]))
                else:
                    splits.append([pronunciation(part) for part in split])
            if len(parts) != len(word) or pronunciation("".join(parts)) != pronunciation(kana):
                flags.append("malformed reading parts")
            elif [pronunciation(part) for part in parts] in splits:
                counts["partsCorroborated"] += 1
            elif splits:
                flags.append("segment boundary differs")
                alternatives["attestedParts"] = splits
            else:
                counts["partsWithoutIndependentSplit"] += 1
        else:
            counts["wholeWordCueOnly"] += 1
        if flags:
            exceptions.append(dict(wordId=ident, spelling=word, kana=kana, cue=cue, parts=parts,
                                   exactOwners=owners, findings=flags, **alternatives))
        counts.update(flags)
    return dict(productionCommit=commit, counts=dict(counts), exceptions=exceptions)


def gap_candidates(db, char, target, data, mapping):
    gov = data["government"]
    words = [w for r, examples in zip(gov["readings"], gov["examples_by_reading"])
             if r == target for w in examples]
    proposals = []
    for example in words:
        word = example.split("〔")[0]
        for kana, in db.execute("SELECT DISTINCT reading FROM form WHERE spelling=? ORDER BY reading", (word,)):
            seg = [json.loads(raw) for raw, in db.execute(
                "SELECT segments FROM segmentation WHERE spelling=? AND reading=?", (word, kana))]
            basis = mapping(char, target, word, kana, seg, data)
            # An official example plus independent, explicit segment alignment can support
            # bound readings that KANJIDIC denotes with hyphens. Never infer sound changes.
            if basis != "supported" and seg:
                def aligned(v):
                    return (word.count(char) == 1 and "".join(x["ruby"] for x in v) == word and
                            "".join(x.get("rt", x["ruby"]) for x in v) == kana and
                            any(x["ruby"] == char and x.get("rt") == pronunciation(target) for x in v))
                if all(aligned(v) for v in seg):
                    basis = "official reading-specific example and exact character segment"
            if basis != "supported" and word.startswith(char) and word.count(char) == 1 and kana == pronunciation(target):
                tail = word[1:]
                if all("ぁ" <= x <= "ゖ" for x in tail) and kana.endswith(tail):
                    basis = "official full form and identical dictionary pronunciation"
            ceiling = (char, target, word, kana) == ("井", "ショウ", "天井", "てんじょう")
            if ceiling and [{"ruby": "天", "rt": "てん"}, {"ruby": "井", "rt": "じょう"}] in seg:
                basis = "reviewed official example: 井 is voiced to じょう in 天井"
            if basis not in ("supported", "official reading-specific example and exact character segment",
                             "official full form and identical dictionary pronunciation",
                             "reviewed official example: 井 is voiced to じょう in 天井"):
                continue
            for ident, indices, raw in forms(db, word, kana):
                if ceiling and (ident != 1438340 or 0 not in json.loads(indices)):
                    continue
                if (char, target, word, kana, ident) == ("君", "きみ", "君", "キミ", 1247250) and any(
                    p["jmdictId"] == ident and p["spelling"] == word and p["kana"] == "きみ" for p in proposals
                ):
                    continue
                senses = json.loads(raw)["sense"]
                options = [(i, glosses(senses[i])) for i in json.loads(indices) if glosses(senses[i])]
                if options:
                    i, gloss = options[0]
                    proposals.append(dict(spelling=word, kana=kana, jmdictId=ident, senseIndex=i,
                                          cue=gloss[0], basis=basis))
    for candidate in proposals:
        if (char, target, candidate["jmdictId"], candidate["spelling"], candidate["kana"]) == (
                "相", "あい", 1749120, "相宿", "あいやど"):
            candidate["priority"] = "reference-only"
    return words, proposals


def gaps(db, review, mapping):
    targets = []
    reused = []
    for path in sorted((review / "outputs").glob("grade-*-proposals-v0.2.json")):
        for r in json.loads(path.read_text("utf8"))["records"]:
            char = r["kanji"]
            for group in r["readingProposals"]:
                rows = group["proposals"]
                if not any(i["readingMapping"] != "supported" for i in rows):
                    continue
                target = group["reading"]
                covered = next((i for i in rows if i["eligibleReadingEvidence"]), None)
                key = dict(grade=r["grade"], kanji=char, reading=target)
                if covered:
                    reused.append(dict(**key, existingExample=[covered["spelling"], covered["kana"]]))
                    continue
                data = json.loads((review.parent / f"consolidation/kanji/grade-{r['grade']}/{char}.json").read_text("utf8"))
                examples, proposals = gap_candidates(db, char, target, data, mapping)
                targets.append(dict(**key, officialExamples=examples, candidates=proposals))
    return dict(existingCoverage=reused, gaps=targets)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", choices=["cards", "gaps"])
    parser.add_argument("research", type=Path, help="path to research/japanese-data with the local SQLite snapshot")
    parser.add_argument("--commit", default="HEAD", help="app revision for the cards report")
    args = parser.parse_args()
    review = args.research.resolve() / "independent-review"
    db = sqlite3.connect((review.parent / "local/curriculum-research.sqlite").as_uri() + "?mode=ro", uri=True)
    db.execute("PRAGMA query_only=ON")
    db.create_function("pronunciation", 1, pronunciation)
    if args.report == "cards":
        commit = subprocess.check_output(["git", "rev-parse", "--verify", args.commit + "^{commit}"],
                                         cwd=ROOT, text=True).strip()
        result = audit(db, commit)
    else:
        sys.path.insert(0, str(review / "tools"))
        from revise_proposals import mapping
        result = gaps(db, review, mapping)
    print(json.dumps(result, ensure_ascii=False, indent=1))
