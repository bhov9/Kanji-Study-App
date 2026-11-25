"""Audit the pinned archives and export review data without touching the application."""
import csv
import gzip
import io
import json
import lzma
import tarfile
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from itertools import combinations

from restore import ROOT, RAW, main as restore

PUBLIC = ROOT / "review"
LOCAL = ROOT / "local"
TARGETS = "太い 太る 太陽 太山 十 大きい 大学 小さい 小学校 生きる 生まれる 生活 学生 上 下 行 日".split()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", "utf8")


def json_archive(prefix):
    with tarfile.open(next(RAW.glob(prefix + "*.tgz"))) as archive:
        return json.load(archive.extractfile(archive.next()))


def dictionaries():
    audit = {}
    for prefix, key in [("jmdict-eng-", "words"), ("jmdict-examples-", "words"),
                        ("kanjidic2-all-", "characters"), ("kradfile-", "kanji")]:
        obj = json_archive(prefix)
        entries = obj.pop(key)
        info = {k: v for k, v in obj.items() if k != "tags"}
        info.update(collection=key, entries=len(entries))
        if isinstance(entries, list):
            info["fields"] = list(entries[0])
            assert len({r.get("id", r.get("literal")) for r in entries}) == len(entries)
        if prefix == "jmdict-examples-":
            ids = set()
            links = 0
            covered = 0
            with (LOCAL / "examples.jsonl").open("w", encoding="utf8") as output:
                for word in entries:
                    seen = False
                    for i, sense in enumerate(word["sense"]):
                        for ex in sense.get("examples", []):
                            links += 1
                            seen = True
                            ids.add((ex["source"]["type"], ex["source"]["value"]))
                            output.write(json.dumps(dict(entry=word["id"], sense_index=i, **ex), ensure_ascii=False) + "\n")
                    covered += seen
            info.update(example_links=links, distinct_source_ids=len(ids), words_with_examples=covered)
        audit[prefix.rstrip("-")] = info
        del entries
    furigana = json.loads((RAW / "JmdictFurigana.json").read_text("utf-8-sig"))
    audit["furigana"] = dict(entries=len(furigana), fields=list(furigana[0]),
        surface_mismatches=sum("".join(f["ruby"] for f in r["furigana"]) != r["text"] for r in furigana))
    for name, record in [("JMdict_e_examp.gz", "entry"), ("kanjidic2.xml.gz", "character")]:
        counts = Counter()
        metadata = {}
        with gzip.open(RAW / name) as stream:
            for _, element in ET.iterparse(stream):
                if element.tag in (record, "example"):
                    counts[element.tag] += 1
                if element.tag in ("file_version", "database_version", "date_of_creation"):
                    metadata[element.tag] = element.text
                if element.tag == record:
                    element.clear()
        audit[name] = dict(counts=counts, header=metadata)
    return audit


def table(stream):
    return csv.DictReader(stream, delimiter="\t", quoting=csv.QUOTE_NONE)


def frequencies(audit):
    data = defaultdict(lambda: defaultdict(list))
    with gzip.open(RAW / "ja-frequency-2026.tsv.gz", "rt", encoding="utf8") as stream:
        rows = table(stream)
        for n, r in enumerate(rows, 1):
            assert int(r["rank"]) == n
            data[r["lemma"]]["shiberu"].append(dict(rank=n, per_million=float(r["per_million"])))
        audit["shiberu"] = dict(entries=n, fields=rows.fieldnames)
    with lzma.open(RAW / "tubelex-ja-lemma-pos.tsv.xz", "rt", encoding="utf8") as stream:
        rows = table(stream)
        counts = [(r["word"], int(r["count"]), r["pos"]) for r in rows if r["word"] != "[TOTAL]"]
        counts.sort(key=lambda x: -x[1])
        previous = None
        for i, (word, count, pos) in enumerate(counts, 1):
            if count != previous:
                rank = i
                previous = count
            data[word]["tubelex"].append(dict(rank=rank, count=count, pos=pos))
        audit["tubelex"] = dict(entries=len(counts), fields=rows.fieldnames)
    for name, lemma, reading, pos in [("bccwj","lemma","lForm","pos"), ("cejc","語彙素","語彙素読み","品詞")]:
        with zipfile.ZipFile(RAW / (name + ".zip")) as z:
            member, = [n for n in z.namelist() if n.endswith(".tsv")]
            with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as stream:
                rows = table(stream)
                for n, r in enumerate(rows, 1):
                    data[r[lemma]][name].append(dict(rank=int(r["rank"]), count=int(r["frequency"]), reading=r[reading], pos=r[pos]))
                audit[name] = dict(entries=n, member=member.split("/")[-1], fields=rows.fieldnames)
    return data


def compare(data, names, dest):
    keys = {name: {word for word, row in data.items() if name in row} for name in names}
    top = {name: {word for word in keys[name] if any(r["rank"] <= 1000 for r in data[word][name])} for name in names}
    with (dest / "ranks.jsonl").open("w", encoding="utf8") as output:
        for word in sorted(set.union(*keys.values())):
            row = {s: data[word].get(s) for s in names}
            output.write(json.dumps(dict(lemma=word, **row), ensure_ascii=False) + "\n")
    save(dest / "comparison.json", dict(
        pairs=[dict(sources=[a,b],shared_spellings=len(keys[a] & keys[b]),
                    shared_top1000_spellings=len(top[a] & top[b])) for a,b in combinations(names,2)],
        examples={w:{s:data.get(w, {}).get(s) for s in names} for w in TARGETS}))


if __name__ == "__main__":
    restore()
    PUBLIC.mkdir(exist_ok=True)
    LOCAL.mkdir(exist_ok=True)
    audit = dictionaries()
    data = frequencies(audit)
    save(PUBLIC / "inventory.json", audit)
    compare(data, ["shiberu","tubelex"], PUBLIC)
    compare(data, ["shiberu","tubelex","bccwj","cejc"], LOCAL)
