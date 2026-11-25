"""Stream the original tables and retain homographs in the illustrative comparison."""
import csv
import gzip
import io
import json
import sys
import zipfile
from pathlib import Path
from itertools import combinations
from collections import defaultdict, Counter
from acquire import HERE, RAW

sys.path.insert(0, str(RAW / "lib"))
import msgpack
import xlrd

targets = "太い 太る 太陽 太山 十 大きい 大学 小さい 小学校 生きる 生まれる 生活 学生 上 下 行 日".split()
comparison = {word: {} for word in targets}
inventory = {}
top = defaultdict(set)


def save(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", "utf8")


def record(word, source, **fields):
    if word in comparison:
        comparison[word].setdefault(source, []).append(fields)


def wordfreq():
    with zipfile.ZipFile(RAW / "wordfreq.whl") as z:
        meta = z.read("wordfreq-3.1.1.dist-info/METADATA").decode()
        (HERE / "wordfreq-credits.md").write_text(meta[meta.index("## License"):], "utf8")
        for size in ("small", "large"):
            member = f"{size}_ja.msgpack.gz"
            src = z.read("wordfreq/data/" + member)
            (HERE / member).write_bytes(src)
            header, *bins = msgpack.unpackb(gzip.decompress(src))
            assert header == {"format":"cB", "version":1}
            count = 0
            for i, words in enumerate(bins):
                for word in words:
                    if size == "large":
                        if count < 1000:
                            top["wordfreq"].add(word)
                        record(word, "wordfreq", rank=count+1, zipf=round(9-i/100, 2))
                count += len(words)
            inventory[member] = count
            if size == "large":
                with (HERE/"wordfreq-ja.tsv").open("w",encoding="utf8",newline="") as out:
                    writer = csv.writer(out,delimiter="\t",lineterminator="\n")
                    writer.writerow(["token","rank","zipf"])
                    rank = 1
                    for i, words in enumerate(bins):
                        writer.writerows((w,rank,f"{9-i/100:.2f}") for w in words)
                        rank += len(words)


def ninjal():
    for unit in ("short", "long"):
        with zipfile.ZipFile(RAW / (unit+".zip")) as z:
            member, = z.namelist()
            with io.TextIOWrapper(z.open(member), encoding="utf8") as f:
                header = f.readline().rstrip().split("\t")
                for count, line in enumerate(f, 1):
                    rank, reading, word, pos, sub, origin, freq, rest = line.split("\t",7)
                    if int(rank) <= 1000:
                        top[unit].add(word)
                    record(word, unit, rank=int(rank), reading=reading, pos=pos, count=int(freq))
                inventory[member] = {"entries":count, "columns":header}
    with zipfile.ZipFile(RAW / "textbooks.zip", metadata_encoding="cp932") as z:
        member, = [n for n in z.namelist() if n.endswith("/教科書.txt")]
        with io.TextIOWrapper(z.open(member), encoding="utf16") as f:
            rows = csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
            positive = 0
            textbook = []
            for count, row in enumerate(rows, 1):
                freq = int(row["度数_小中高_全教科"])
                positive += freq > 0
                textbook.append((freq,row["語彙素"]))
                record(row["語彙素"], "textbook", reading=row["語彙素読み"], pos=row["品詞"], count=freq)
            inventory[member] = dict(entries=count, attested=positive, columns=rows.fieldnames)
            distribution = Counter(f for f,_ in textbook)
            ranks = {}
            rank = 1
            for freq in sorted(distribution,reverse=True):
                ranks[freq] = rank
                rank += distribution[freq]
            top["textbook"].update(w for f,w in textbook if ranks[f]<=1000)
            for row in comparison.values():
                for item in row.get("textbook",[]):
                    item["rank"] = ranks[item["count"]]
        with (RAW / "subjects.jsonl").open("w",encoding="utf8") as out:
            for n in z.namelist():
                if "/4_" not in n or not n.endswith(".xls"):
                    continue
                book = xlrd.open_workbook(file_contents=z.read(n))
                s, = [sheet for sheet in book.sheets() if sheet.nrows]
                fields = s.row_values(0)
                for i in range(1,s.nrows):
                    row = dict(zip(fields, s.row_values(i)))
                    out.write(json.dumps(dict(source=Path(n).stem, fields=row), ensure_ascii=False)+"\n")
                inventory[Path(n).name] = dict(entries=s.nrows-1, columns=fields)


if __name__ == "__main__":
    wordfreq()
    ninjal()
    old = json.loads((HERE.parent/"local/comparison.json").read_text("utf8"))
    for word, row in comparison.items():
        row.update(old["examples"][word])
        for source in ("wordfreq","short","long","textbook"):
            row.setdefault(source,None)
    with (HERE.parent/"local/ranks.jsonl").open(encoding="utf8") as src:
        for line in src:
            row = json.loads(line)
            for source in ("shiberu","tubelex","bccwj","cejc"):
                if any(r["rank"]<=1000 for r in row[source] or []):
                    top[source].add(row["lemma"])
    save(RAW/"overlap.json", [dict(sources=[a,b], shared=len(top[a]&top[b]),
        top_spellings=[len(top[a]),len(top[b])]) for a,b in combinations(sorted(top),2)])
    save(RAW/"comparison.json",comparison)
    save(HERE/"frequency-inventory.json",inventory)
