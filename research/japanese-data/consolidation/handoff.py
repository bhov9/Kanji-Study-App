"""Export dictionary lookups, regression cases, and license-safe aggregate validation."""
import csv
import gzip
import hashlib
import json
import sqlite3
from collections import Counter,defaultdict
from itertools import combinations
from pathlib import Path
from database import HERE,DB,LOCAL,compact
from rankings import save,CUTS,SOURCES,WEIGHTS

CASES="十 太山 太い 太る 太陽 廉い 安い 冥い 暗い 英斤 尼羅 小学校 生 大 大きい 大学".split()


def evidence(con,text,kana):
    return [dict(source=s,rank=r,scope="form pair" if v else "spelling") for s,v,r in con.execute(
        "SELECT source,reading,min(rank) FROM evidence WHERE spelling=? AND (reading='' OR reading=?) "
        "AND source!='jiten:kanji' GROUP BY source,reading ORDER BY source",(text,kana))]


def main():
    con=sqlite3.connect(DB)
    chosen=defaultdict(set)
    topforms={}
    for method in WEIGHTS:
        ids=set()
        forms=[]
        for p in sorted((HERE/"rankings"/method.replace(":","-")).glob("*.tsv")):
            with p.open(encoding="utf8") as f:
                for row in csv.DictReader(f,delimiter="\t"):
                    ident=int(row["jmdict"])
                    assert ident not in ids
                    ids.add(ident)
                    chosen[ident].add((row["form"],row["reading"]))
                    forms.append(row["form"])
        assert len(ids)==10000
        topforms[method]=forms
    batches=defaultdict(list)
    for ident,forms in sorted(chosen.items()):
        word=json.loads(con.execute("SELECT dictionary_json FROM entry WHERE id=?",(ident,)).fetchone()[0])
        word["reviewForms"]=[]
        for text,kana in sorted(forms):
            senses=json.loads(con.execute("SELECT sense_indices FROM form WHERE id=? AND spelling=? AND reading=?",
                                (ident,text,kana)).fetchone()[0])
            segments=[json.loads(r[0]) for r in con.execute("SELECT segments FROM segmentation WHERE spelling=? AND reading=?",(text,kana))]
            word["reviewForms"].append(dict(spelling=text,reading=kana,senseIndices=senses,
                segmentation=segments,observations=evidence(con,text,kana)))
        batches[ident//10000].append(compact(word))
    for bucket,rows in batches.items():
        p=HERE/"lexicon"/f"{bucket}.jsonl"
        p.parent.mkdir(exist_ok=True)
        p.write_text("\n".join(rows)+"\n","utf8")
    deck=[r for p in sorted((HERE/"deck").glob("*.json")) for r in json.loads(p.read_text("utf8"))]
    focus={}
    for text in CASES:
        forms=[]
        for ident,kana,idx,raw in con.execute("SELECT id,reading,sense_indices,dictionary_json FROM form JOIN entry USING(id) WHERE spelling=?",(text,)):
            word=json.loads(raw)
            forms.append(dict(id=ident,kana=kana,senses=[word["sense"][i] for i in json.loads(idx)],
                              spelling_tags=[f["tags"] for f in word["kanji"] if f["text"]==text],
                              evidence=evidence(con,text,kana)))
        focus[text]=dict(dictionary=forms,deck=[w for w in deck if w["form"]==text])
    save(HERE/"regression-cases.json",focus)
    validation=json.loads((LOCAL/"rank-validation.json").read_text("utf8"))
    # Share aggregate overlaps only. Restricted lexical rows remain local.
    extra=defaultdict(set)
    import openpyxl
    path=LOCAL/"VDRJ_Ver1_0_Teachers_Top60894.xlsx"
    if path.exists():
        assert hashlib.sha256(path.read_bytes()).hexdigest()=="22dde654b967dde38ce93c0532a7b5d730a4d7b2c16b7b840a4aa89008500173"
        book=openpyxl.load_workbook(path,read_only=True,data_only=True)
        for row in book.worksheets[-1].iter_rows(min_row=2,values_only=True):
            if isinstance(row[3],(int,float)) and row[3]<=1000:
                extra["vdrj_general_top1000"].add(row[14])
        book.close()
    for line in (LOCAL/"supplement/subjects.jsonl").open(encoding="utf8"):
        extra["subject_list_union"].add(json.loads(line)["fields"]["語彙素"])
    for method,forms in topforms.items():
        for cut in CUTS:
            for label,words in extra.items():
                validation["overlaps"][method][str(cut)][label]=len(set(forms[:cut])&words)
    validation["additional_reference_sizes"]={k:len(v) for k,v in extra.items()}
    save(HERE/"validation-aggregates.json",validation)
    q=json.loads((HERE/"quality.json").read_text("utf8"))
    q.update(review_lexical_entries=len(chosen),source_rows=dict(con.execute("SELECT source,count(*) FROM evidence GROUP BY source")),
             ambiguous_dictionary_spellings=con.execute("SELECT count(*) FROM (SELECT spelling FROM form GROUP BY spelling HAVING count(DISTINCT id)>1)").fetchone()[0],
             eligible_form_pairs=con.execute("SELECT count(*) FROM scoring").fetchone()[0])
    save(HERE/"quality.json",q)
    con.close()


if __name__=="__main__":main()
