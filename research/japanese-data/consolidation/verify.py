"""Check the published review files and produce a coverage audit of exact-match exclusions."""
import csv
import gzip
import hashlib
import json
import sqlite3
from collections import Counter
from database import HERE,DB,form_rows
from rankings import SOURCES,WEIGHTS,save

def main():
    con=sqlite3.connect(DB)
    assert con.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
    for meta in json.loads((HERE/"jiten/manifest.json").read_text("utf8")):
        raw=gzip.decompress((HERE/"jiten"/meta["file"]).read_bytes())
        assert len(raw)==meta["bytes"] and hashlib.sha256(raw).hexdigest()==meta["sha256"]
    assert not con.execute("SELECT 1 FROM form WHERE spelling='' OR reading='' OR sense_indices='[]' LIMIT 1").fetchone()
    assert not con.execute("PRAGMA foreign_key_check").fetchall()
    sample={"id":1,"kanji":[{"text":"甲","common":False},{"text":"乙","common":False}],
        "kana":[{"text":"きのえ","common":True,"appliesToKanji":["甲"]}],
        "sense":[{"appliesToKanji":["乙"],"appliesToKana":["*"]},{"appliesToKanji":["甲"],"appliesToKana":["きのえ"]}]}
    assert list(form_rows(sample))==[(1,"甲","きのえ","[1]",1)]
    refs=set()
    for p in (HERE/"lexicon").glob("*.jsonl"):
        for l in p.open(encoding="utf8"):
            r=json.loads(l)
            ident=int(r["id"])
            assert ident not in refs and ident//10000==int(p.stem)
            refs.add(ident)
            for form in r["reviewForms"]:
                assert all(0<=i<len(r["sense"]) for i in form["senseIndices"])
    for method in WEIGHTS:
        seen=set()
        for p in sorted((HERE/"rankings"/method.replace(":","-")).glob("*.tsv")):
            with p.open(encoding="utf8") as f:
                for r in csv.DictReader(f,delimiter="\t"):
                    i=int(r["jmdict"])
                    assert i in refs and i not in seen and int(r["position"])==len(seen)+1
                    seen.add(i)
        assert len(seen)==10000
    files=list((HERE/"kanji").glob("*/*.json"))
    assert len(files)==2136
    official=0
    for p in files:
        r=json.loads(p.read_text("utf8"))
        assert p.stem==r["character"] and len(r["handwriting_candidates"])<=30
        assert set(r["handwriting_candidates"])<=r["candidates"].keys()
        for v in r["readings"]:
            if v["official"]:
                official+=1
                assert v["stage"] in ("elementary","junior_high","senior_high")
            assert len(v["candidates"])<=10 and set(v["candidates"])<=r["candidates"].keys()
            for key in v["candidates"]:
                assert v["reading"] in r["candidates"][key]["matched"]
    assert official==4388
    missing={}
    for source in SOURCES:
        tally=Counter()
        cases=[]
        for word,kana,rank in con.execute("SELECT spelling,reading,rank FROM evidence WHERE source=? AND rank<=1000 ORDER BY rank",(source,)):
            candidates=con.execute("SELECT DISTINCT id FROM form WHERE spelling=? AND (?='' OR reading=?)",(word,kana,kana)).fetchall()
            reason="unique" if len(candidates)==1 else "ambiguous" if candidates else "no exact form"
            tally[reason]+=1
            if reason!="unique" and len(cases)<30:
                cases.append(dict(word=word,kana=kana or None,rank=rank,reason=reason,candidate_ids=[c[0] for c in candidates]))
        missing[source]=dict(counts=tally,examples=cases)
    save(HERE/"unresolved-frequent.json",missing)
    print(f"Verified {len(refs)} dictionary lookups, nine disjoint-ID lists, {len(files)} kanji and {official} official readings.")

if __name__=="__main__":main()
