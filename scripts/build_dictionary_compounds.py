"""Build Jōyō compound examples from this release's JMdict shards and pinned JmdictFurigana."""
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import sys
from build_dictionary import ROOT, VERSION


def build(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != "57c2afa7d153d42df97811d4a44865d10fb9104f6a7bacbbe32a0bf0c38e5abc":
        raise ValueError("Expected the pinned JmdictFurigana release")
    splits = {}
    for item in json.loads(raw):
        parts = item["furigana"]
        if not all(len(p["ruby"]) == 1 and p.get("rt") for p in parts):
            continue
        if "".join(p["ruby"] for p in parts) == item["text"] and "".join(p["rt"] for p in parts) == item["reading"]:
            splits.setdefault((item["text"],item["reading"]),set()).add(tuple(p["rt"] for p in parts))
    result = defaultdict(list)
    for file in sorted((ROOT / "dictionary" / VERSION).glob("e*.bin")):
        for entry in json.loads(gzip.decompress(file.read_bytes())):
            for form in entry["kanji"]:
                word = form["text"]
                if not form["common"] or form["tags"] or not 2 <= len(word) <= 4:
                    continue
                for reading in entry["kana"]:
                    kana = reading["text"]
                    if not reading["common"] or reading["tags"] or ("*" not in reading["appliesToKanji"] and word not in reading["appliesToKanji"]):
                        continue
                    parts = splits.get((word,kana),set())
                    if len(parts) != 1:
                        continue
                    for c in set(word):
                        result[c].append((word,kana,next(iter(parts)),entry["id"]))
    rows = {c:sorted(set(values), key=lambda v:(len(v[0]),int(v[3]),v))[:5] for c,values in result.items()}
    (ROOT/"dictionary-compounds.js").write_text("// Common JMdict forms with JmdictFurigana splits · CC BY-SA 4.0\nexport const commonCompounds = "+
        json.dumps(rows, ensure_ascii=False,sort_keys=True,separators=(",",":"))+";\n",encoding="utf8")

if __name__ == "__main__":
    build(Path(sys.argv[1]))
