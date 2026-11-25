"""Build the local SQLite research snapshot. All SQL joins are exact Unicode matches."""
import csv
import gzip
import json
import lzma
import sqlite3
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent
RAW = DATA/"package/raw"
LOCAL = DATA/"local"
DB = LOCAL/"curriculum-research.sqlite"
PRODUCTION = "d70055576c40b91fd40f7180f4e7d27f3d9f27a3"


def compact(obj):
    return json.dumps(obj,ensure_ascii=False,separators=(",",":"))


def archive(prefix):
    with tarfile.open(next(RAW.glob(prefix+"*.tgz"))) as t:
        return json.load(t.extractfile(t.next()))


def permitted(items, value):
    return "*" in items or value in items


def form_rows(word):
    for kana in word["kana"]:
        reading = kana["text"]
        spellings = [k for k in word["kanji"] if permitted(kana["appliesToKanji"],k["text"])]
        for spelling in spellings or [None]:
            text = spelling["text"] if spelling else reading
            senses = [i for i,s in enumerate(word["sense"]) if permitted(s["appliesToKanji"],text)
                      and permitted(s["appliesToKana"],reading)]
            if senses:
                yield (word["id"],text,reading,compact(senses),int(kana["common"] or bool(spelling and spelling["common"])))


def source_rows():
    with lzma.open(RAW/"tubelex-ja-lemma-pos.tsv.xz","rt",encoding="utf8") as f:
        rows = csv.DictReader(f,delimiter="\t",quoting=csv.QUOTE_NONE)
        last = None
        for n,r in enumerate(rows,1):
            if r["word"]=="[TOTAL]":
                continue
            count = int(r["count"])
            if count != last:
                assert last is None or count < last
                last,rank = count,n
            yield "tubelex",r["word"],"",rank,compact(r)
    for l in (DATA/"review/ranks.jsonl").open(encoding="utf8"):
        row=json.loads(l)
        for value in row["shiberu"] or []:
            yield "shiberu",row["lemma"],"",value["rank"],compact(value)
    with (DATA/"supplement/wordfreq-ja.tsv").open(encoding="utf8") as f:
        for row in csv.DictReader(f,delimiter="\t"):
            yield "wordfreq",row["token"],"",int(row["rank"]),compact(row)
    manifest=json.loads((HERE/"jiten/manifest.json").read_text("utf8"))
    assert len(manifest)==13
    for file in manifest:
        source="kanji" if file["file"]=="kanji.csv.gz" else file["upstream_filename"].split("filename=jiten_freq_")[1].split(".csv")[0].lower()
        with gzip.open(HERE/"jiten"/file["file"],"rt",encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                if file["file"]=="kanji.csv.gz":
                    yield "jiten:kanji",next(iter(row.values())),"",int(row["Rank"]),compact(row)
                else:
                    yield "jiten:"+source,row["Word"],row["Form"],int(row["Rank"]),None


def main():
    stage=DB.with_suffix(".building")
    stage.unlink(missing_ok=True)
    con=sqlite3.connect(stage)
    con.executescript("""
    PRAGMA journal_mode=OFF;
    PRAGMA synchronous=OFF;
    CREATE TABLE entry(id INTEGER PRIMARY KEY, dictionary_json TEXT NOT NULL);
    CREATE TABLE form(id INTEGER REFERENCES entry, spelling TEXT, reading TEXT, sense_indices TEXT, common INTEGER,
                      PRIMARY KEY(id,spelling,reading));
    CREATE TABLE segmentation(spelling TEXT,reading TEXT,segments TEXT);
    CREATE TABLE evidence(source TEXT,spelling TEXT,reading TEXT,rank INTEGER,metadata TEXT);
    """)
    words=archive("jmdict-eng-")["words"]
    for word in words:
        con.execute("INSERT INTO entry VALUES(?,?)",(word["id"],compact(word)))
        con.executemany("INSERT INTO form VALUES(?,?,?,?,?)",form_rows(word))
    del words
    for row in json.loads((RAW/"JmdictFurigana.json").read_text("utf-8-sig")):
        con.execute("INSERT INTO segmentation VALUES(?,?,?)",(row["text"],row["reading"],compact(row["furigana"])))
    con.executemany("INSERT INTO evidence VALUES(?,?,?,?,?)",source_rows())
    con.executescript("""
    CREATE INDEX evidence_lookup ON evidence(spelling,reading,source);
    CREATE INDEX form_lookup ON form(spelling,reading);
    CREATE INDEX segmentation_lookup ON segmentation(spelling,reading);
    CREATE VIEW form_evidence AS SELECT f.id,f.spelling,f.reading,e.source,e.rank,e.metadata,
        CASE WHEN e.reading='' THEN 'spelling' ELSE 'form-pair' END AS scope
        FROM form f JOIN evidence e ON e.spelling=f.spelling AND (e.reading='' OR e.reading=f.reading)
        WHERE e.source!='jiten:kanji';
    """)
    assert con.execute("pragma integrity_check").fetchone()[0]=="ok"
    assert not list(con.execute("pragma foreign_key_check"))
    con.commit()
    con.close()
    stage.replace(DB)


if __name__=="__main__":
    main()

