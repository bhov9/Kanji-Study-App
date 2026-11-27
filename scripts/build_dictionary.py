"""Build offline JMdict assets: python scripts/build_dictionary.py PATH_TO_PINNED_TGZ."""
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile
import unicodedata

VERSION = "3.6.2+20261123231529"
CHECKSUM = "fbeabd2f9dce8d5b2c831e1ee6f859f8f200dd6c96d7a16f0f0004dd5bc9c786"
ROOT = Path(__file__).resolve().parents[1]
SIZE = 1500
BUCKETS = 128


def normalize(value):
    return "".join(chr(ord(c)-96) if "ァ" <= c <= "ヶ" else c
                   for c in unicodedata.normalize("NFKC", value).lower().strip())


def preview(word):
    return [[f["text"] for f in word["kanji"]],
            [[r["text"], r["appliesToKanji"]] for r in word["kana"]],
            word["sense"][0]["gloss"][0]["text"]]


def build(archive):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != CHECKSUM:
        raise ValueError("Expected the pinned English JMdict archive")
    with tarfile.open(archive) as tar:
        member, = [m for m in tar if m.name.endswith(".json")]
        data = json.load(tar.extractfile(member))
    assert data["languages"] == ["eng"] and not data["commonOnly"]
    out = ROOT / "dictionary" / VERSION
    out.mkdir(parents=True, exist_ok=True)
    files = []
    def write(name, value):
        raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
        (out / name).write_bytes(gzip.compress(raw, compresslevel=6, mtime=0))
        files.append(name)

    buckets = [defaultdict(list) for _ in range(BUCKETS)]
    batch = []
    for idx, word in enumerate(data["words"]):
        keys = {}
        def add(text, tier, common):
            key = normalize(text)
            if key:
                score = tier * 2 + int(not common)
                keys[key] = min(keys.get(key, score), score)
        for form in word["kanji"] + word["kana"]:
            add(form["text"], 0, form["common"])
        common = any(f["common"] for f in word["kanji"] + word["kana"])
        for sense in word["sense"]:
            for gloss in sense["gloss"]:
                if gloss["lang"] != "eng":
                    continue
                value = gloss["text"]
                add(value, 1, common)
                if value.startswith("to "):
                    add(value[3:], 1, common)
                for token in re.findall(r"[a-zA-Z]{2,}", value):
                    if token.lower() not in {"an","the","to","of","and","or","in","on","at","for","with"}:
                        add(token, 2, common)
        for key, score in keys.items():
            buckets[ord(key[0]) % BUCKETS][key].append(idx * 6 + score)
        batch.append(word)
        if len(batch) == SIZE or idx+1 == len(data["words"]):
            write(f"e{idx//SIZE}.bin", batch)
            write(f"p{idx//SIZE}.bin", [preview(item) for item in batch])
            batch = []
    for i, bucket in enumerate(buckets):
        write(f"s{i}.bin", sorted(bucket.items()))
    manifest = dict(version=VERSION, count=len(data["words"]), date=data["dictDate"],
                    size=SIZE, buckets=BUCKETS, files=files, tags=data["tags"], license="CC BY-SA 4.0",
                    source="https://github.com/scriptin/jmdict-simplified/releases/download/" +
                    VERSION.replace("+","%2B") + "/jmdict-eng-" + VERSION.replace("+","%2B") + ".json.tgz",
                    sha256=CHECKSUM)
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
    print(len(data["words"]), "entries;", len(files), "compressed shards")

if __name__ == "__main__":
    build(Path(sys.argv[1]))
