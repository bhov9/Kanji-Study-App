"""Compare provisional reciprocal-rank combinations on restriction-valid dictionary forms."""
import csv
import itertools
import json
import math
import sqlite3
from collections import defaultdict
from database import HERE, DB, LOCAL, compact

SOURCES=["shiberu","tubelex","wordfreq","jiten:global"]
WEIGHTS={s:[int(i==j) for i in range(4)] for j,s in enumerate(SOURCES)}
WEIGHTS.update(equal=[1,1,1,1],conversation=[1,5,3,1],general=[3,3,3,1],
               written=[5,1,2,2],overlap=[4,3,2,1])
CUTS=[100,500,1000,2000,5000,10000]


def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n","utf8")


def main():
    con=sqlite3.connect(DB)
    owners=defaultdict(set)
    pairs=defaultdict(set)
    forms=list(con.execute("SELECT id,spelling,reading,common FROM form"))
    for ident,text,kana,_ in forms:
        owners[text].add(ident)
        pairs[text,kana].add(ident)
    ev=defaultdict(dict)
    channels={}
    for source,text,reading,rank,meta in con.execute("SELECT * FROM evidence WHERE source IN (?,?,?,?)",SOURCES):
        target=ev[text,reading]
        target[source]=min(rank,target.get(source,rank))
        if source=="tubelex":
            channels[text]=int(json.loads(meta)["channels"])
    results={m:{} for m in WEIGHTS}
    con.execute("DROP TABLE IF EXISTS scoring")
    con.execute("CREATE TABLE scoring(id INTEGER, spelling TEXT, reading TEXT, ranks TEXT, general REAL, PRIMARY KEY(id,spelling,reading))")
    for ident,text,kana,common in forms:
        ranks=[ev.get((text,""),{}).get(s) if len(owners[text])==1 else None for s in SOURCES[:3]]
        ranks.append(ev.get((text,kana),{}).get(SOURCES[3]) if len(pairs[text,kana])==1 else None)
        if not any(ranks):
            continue
        vals=[1/(100+r) if r else 0 for r in ranks]
        for method,weights in WEIGHTS.items():
            adjusted=vals
            if method=="overlap":
                adjusted=vals.copy()
                adjusted[1]*=min(1,math.log1p(channels.get(text,0))/math.log(51))
                adjusted[3]*=0.75 if ranks[1] else 1
            score=sum(w*v for w,v in zip(weights,adjusted))/sum(weights)
            if method=="general":
                con.execute("INSERT INTO scoring VALUES(?,?,?,?,?)",(ident,text,kana,compact(ranks),score))
            if score<=0: continue
            item=(score,common,text,kana,tuple(ranks))
            prev=results[method].get(ident)
            if prev is None or item[:4]>prev[:4]:
                results[method][ident]=item
    con.commit()
    by_method={}
    summary={}
    for method,values in results.items():
        name=method.replace(":","-")
        ordered=sorted(values,key=lambda k:(-values[k][0],-values[k][1],k))[:10000]
        assert len(ordered)==10000
        by_method[method]=ordered
        summary[method]={"eligible_ids":len(values)}
        for start in range(0,len(ordered),500):
            out=HERE/"rankings"/name/f"{start+1:05}-{start+500:05}.tsv"
            out.parent.mkdir(parents=True,exist_ok=True)
            with out.open("w",encoding="utf8",newline="") as f:
                w=csv.writer(f,delimiter="\t",lineterminator="\n")
                w.writerow(["position","jmdict","form","reading","score",*SOURCES])
                for n,ident in enumerate(ordered[start:start+500],start+1):
                    score,common,text,kana,ranks=values[ident]
                    w.writerow([n,ident,text,kana,f"{score:.8g}",*ranks])
    overlaps={a+" / "+b:{k:len(set(by_method[a][:k])&set(by_method[b][:k])) for k in CUTS}
              for a,b in itertools.combinations(by_method,2)}
    general=set(by_method["general"])
    disagreements={m:[dict(id=i,form=results[m][i][2],ranks=results[m][i][4]) for i in ids if i not in general][:25]
                   for m,ids in by_method.items() if m!="general"}
    save(HERE/"rank-comparison.json",dict(sources=SOURCES,weights=WEIGHTS,coverage=summary,overlap=overlaps,
        high_ranked_outside_general_top10000=disagreements))
    validation={}
    from collections import Counter
    labels=["bccwj","cejc","short","long","textbook"]
    top={s:set() for s in labels}
    for l in (LOCAL/"ranks.jsonl").open(encoding="utf8"):
        r=json.loads(l)
        for s in labels[:2]:
            if any(x["rank"]<=1000 for x in r[s] or []):top[s].add(r["lemma"])
    import zipfile,io
    for s in labels[2:4]:
        with zipfile.ZipFile(LOCAL/"supplement"/(s+".zip")) as z:
            with io.TextIOWrapper(z.open(z.namelist()[0]),encoding="utf8") as f:
                for r in csv.DictReader(f,delimiter="\t",quoting=csv.QUOTE_NONE):
                    if int(r["rank"])>1000:break
                    top[s].add(r["lemma"])
    with zipfile.ZipFile(LOCAL/"supplement/textbooks.zip",metadata_encoding="cp932") as z:
        with io.TextIOWrapper(z.open(next(n for n in z.namelist() if n.endswith("/教科書.txt"))),encoding="utf16") as f:
            obs=sorted([(int(r["度数_小中高_全教科"]),r["語彙素"]) for r in csv.DictReader(f,delimiter="\t")],reverse=True)
            top["textbook"]={w for n,w in obs if n>=obs[999][0]}
    for m,ids in by_method.items():
        validation[m]={k:{s:len({results[m][i][2] for i in ids[:k]}&words) for s,words in top.items()} for k in CUTS}
    save(LOCAL/"rank-validation.json",dict(reference_top1000_sizes={k:len(v) for k,v in top.items()},overlaps=validation))
    con.close()


if __name__=="__main__":
    main()
