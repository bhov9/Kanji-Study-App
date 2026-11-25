"""Generate inspectable kanji records, provisional policy evidence and a deck audit."""
import heapq
import json
import sqlite3
import subprocess
from collections import Counter,defaultdict
from database import HERE,DATA,DB,PRODUCTION,archive,compact
from rankings import save,SOURCES

def from_production(name):
    return json.loads(subprocess.check_output(["git","show",f"{PRODUCTION}:linguistic-review/{name}.json"],cwd=HERE))

def records(name):
    return [json.loads(l) for l in (DATA/"supplement"/(name+".jsonl")).read_text("utf8").splitlines()]

def hira(text):
    return "".join(chr(ord(c)-96) if "ァ"<=c<="ヶ" else c for c in text)

def offer(heap,limit,item):
    if len(heap)<limit: heapq.heappush(heap,item)
    elif item>heap[0]: heapq.heapreplace(heap,item)

def labels(word,indices):
    return sorted({tag for i in indices for tag in word["sense"][i]["misc"]})

def main():
    con=sqlite3.connect(DB)
    gov={r["kanji"]:r for r in records("joyo")}
    stages={(r["kanji"],r["reading"]):r for r in records("stages")}
    app={r["character"]:r for r in from_production("kanji")}
    grades={k:r["grade"] for k,r in app.items()}
    assert app.keys()==gov.keys()
    parts=archive("kradfile-")["kanji"]
    kd={r["literal"]:r for r in archive("kanjidic2-all")["characters"] if r["literal"] in app}
    readings={}
    for k,item in app.items():
        data=kd[k]["readingMeaning"] or {}
        groups=data.get("groups",[])
        japanese=[v for group in groups for v in group["readings"] if v["type"] in ("ja_on","ja_kun")]
        item["onyomi"]=[v["value"] for v in japanese if v["type"]=="ja_on"]
        kun=[v["value"] for v in japanese if v["type"]=="ja_kun"]
        item["kunyomi"]=[dict(sourceNotation=v,stem=v.partition(".")[0],
                              okurigana=v.partition(".")[2] or None) for v in kun]
        item["englishMeanings"]=[v["value"] for g in groups for v in g["meanings"] if v["lang"]=="en"]
        item["nanori"]=data.get("nanori",[])
        readings[k]=list(dict.fromkeys(item["onyomi"]+kun))
    reading_counts=dict(con.execute("SELECT spelling,count(DISTINCT reading) FROM form GROUP BY spelling"))
    piles=defaultdict(list)
    coverage=defaultdict(set)
    unsupported=Counter()
    segs=defaultdict(list)
    for s,r,segments in con.execute("SELECT * FROM segmentation"):
        segs[s,r].append(json.loads(segments))
    vocab=from_production("vocabulary")
    current=defaultdict(list)
    for word in vocab:
        for k in set(word["kanjiIds"]):current[k].append(word["wordId"])
    # One heap item per candidate form. Repeated occurrences of a kanji in a word count once.
    q="""SELECT f.id,f.spelling,f.reading,f.sense_indices,f.common,e.dictionary_json,
        s.ranks,s.general FROM form f JOIN entry e USING(id) LEFT JOIN scoring s
        USING(id,spelling,reading)"""
    for ident,text,reading,indices,common,raw,ranks,score in con.execute(q):
        targets=set(text)&app.keys()
        if not targets:continue
        indices=json.loads(indices)
        word=json.loads(raw)
        sense=word["sense"][indices[0]]
        cue=next((g["text"] for g in sense["gloss"] if g["lang"]=="eng"),"")
        tags=labels(word,indices)
        spelling_tags=[t for f in word["kanji"] if f["text"]==text for t in f["tags"]]
        issues=sorted(set(tags+spelling_tags)&{"arch","obs","rare","uk","rK","iK","oK","ateji","dated","vulg","derog"})
        pairs=segs.get((text,reading),[])
        segments=pairs[0] if len(pairs)==1 else []
        if not segments and len(text)==1 and text in targets:segments=[{"ruby":text,"rt":reading}]
        if hira("".join(f.get("rt",f["ruby"]) for f in segments))!=hira(reading):
            segments=[]
        ranks=json.loads(ranks) if ranks else [None]*4
        info=dict(id=ident,form=text,kana=reading,gloss=cue,senses=indices,common=bool(common),
                  pos=sense["partOfSpeech"],flags=issues,ranks=ranks,reading_evidence=bool(ranks[3] or reading_counts[text]==1 and any(ranks)))
        key=f"{ident}/{text}/{reading}"
        for k in targets:
            examples=gov[k]["examples_by_reading"]
            official=gov[k]["readings"]
            exact=[v for v,ex in zip(official,examples) if text in ex]
            mapped={}
            for n,seg in enumerate(segments):
                if seg["ruby"]!=k or "rt" not in seg:continue
                actual=hira(seg["rt"])
                suffix="".join(f["ruby"] for f in segments[n+1:])
                matches=[]
                for policy in readings[k]:
                    stem,_,okuri=policy.strip("-").partition(".")
                    if hira(stem)==actual and suffix.startswith(okuri):
                        matches.append(policy)
                # Prefer the longest attested okurigana over a bare shared stem.
                basis="exact segment"
                if not matches:
                    # Generate only mechanically compatible hypotheses; retain uncertainty.
                    following=hira("".join(f.get("rt",f["ruby"]) for f in segments[n+1:]))
                    for policy in readings[k]:
                        stem,_,okuri=policy.strip("-").partition(".")
                        stem=hira(stem)
                        if okuri or len(stem)<2:continue
                        if following and following[0] in "かきくけこさしすせそたちつてとぱぴぷぺぽ" and stem[-1] in "くきつち" and actual==stem[:-1]+"っ":
                            matches.append(policy)
                            basis="possible gemination"
                        elif n and stem[0] in "かきくけこさしすせそたちつてとはひふへほ" and actual==chr(ord(stem[0])+1)+stem[1:]:
                            matches.append(policy)
                            basis="possible rendaku"
                if matches:
                    length=max(len(v.strip("-").partition(".")[2]) for v in matches)
                    matches=[v for v in matches if len(v.strip("-").partition(".")[2])==length]
                for value in exact:
                    if any(v.replace(".","").strip("-")==value for v in matches): continue
                    if len(exact)==1 and (hira(value)==actual or hira(value).startswith(actual) and suffix.startswith(hira(value)[len(actual):])):
                        matches.append(value)
                # Multiple compatible stems or suffixes cannot determine a unique reading.
                normalized={v.replace(".","").strip("-") for v in matches}
                if len(normalized)==1:
                    mapped[next(iter(normalized))]=dict(actual=seg["rt"],dictionary=matches,basis=basis)
                elif len(exact)==1 and not matches:
                    mapped[exact[0]]=dict(actual=seg["rt"],dictionary=[],basis="official example; phonological difference requires review")
            other={c:grades[c] for c in targets-{k}}
            suitability=(int(not issues),int(bool(mapped)),int(bool(exact)),sum(r is not None for r in ranks),
                         score or 0,common,-max(other.values(),default=0),-len(text))
            tier="reference-only" if issues or not mapped else "secondary"
            if tier=="secondary" and any(m.get("basis")=="exact segment" for m in mapped.values()) and (common or exact) and sum(r is not None and r<=10000 for r in ranks)>=2 and len(indices)==1:
                tier="preferred"
            row=dict(**info,other_grades=other,matched=mapped,official_examples=exact,handwriting_tier=tier)
            item=(suitability,key,compact(row))
            offer(piles[k],30,item)
            for v in mapped:
                offer(piles[k,v],10,item)
                if score and info["reading_evidence"] and mapped[v].get("basis")=="exact segment":coverage[k,v].add(ident)
            if not mapped:unsupported[k]+=1
    audit=[]
    current_support=defaultdict(set)
    for word in vocab:
        text,reading=word["spelling"],word["hiragana"]
        matches=list(con.execute("SELECT f.id,f.sense_indices,e.dictionary_json FROM form f JOIN entry e USING(id) WHERE f.spelling=? AND f.reading=?",(text,reading)))
        flags=set()
        for ident,indices,raw in matches:
            data=json.loads(raw)
            flags.update(labels(data,json.loads(indices)))
            flags.update(t for f in data["kanji"] if f["text"]==text for t in f["tags"])
        ranks={}
        for source,rank in con.execute("SELECT source,min(rank) FROM evidence WHERE spelling=? AND (reading='' OR reading=?) AND source IN (?,?,?,?) GROUP BY source",(text,reading,*SOURCES)):
            ranks[source]=rank
        issues=[]
        if not ranks:issues.append("no primary exact-form evidence")
        if len(matches)!=1:issues.append("dictionary identity needs review")
        if word["mappingStatus"]!="mapped":issues.append("check segmentation")
        if any(max(grades.get(c,0) for c in text)>grades.get(k,0) for k in word["kanjiIds"]):issues.append("contains later-grade kanji")
        if len(word["englishMeaning"].split(";"))>1 or len(matches)>1:issues.append("check cue ambiguity")
        if word["englishMeaning"][:1].isupper() and any(c in word["englishMeaning"] for c in ["river","name","city"]):issues.append("check proper-name cue")
        flags=sorted(flags&{"arch","obs","rare","uk","rK","iK","oK","ateji","dated"})
        mapping=word.get("readingMapping") or []
        for n,seg in enumerate(mapping):
            k=seg.get("kanjiId")
            if k in app and seg.get("kana"):
                tail="".join(part["written"] for part in mapping[n+1:])
                opts=[v for v in readings[k] if hira(v.strip("-").split(".")[0])==hira(seg["kana"])
                      and tail.startswith(v.strip("-").partition(".")[2])]
                if len(opts)==1:current_support[k].add(opts[0].replace(".","").strip("-"))
        audit.append(dict(wordId=word["wordId"],form=text,kana=reading,cue=word["englishMeaning"],
                         ids=[m[0] for m in matches],mapping=word["mappingStatus"],flags=flags,issues=issues,
                         raw_form_ranks=ranks))
    audit_by_id={a["wordId"]:a for a in audit}
    appendix=records("appendices")
    policy_counts=Counter()
    for k,rec in app.items():
        official=gov[k]["readings"]
        allread=list(dict.fromkeys(official+[v.replace(".","").strip("-") for v in readings[k]]))
        candidates={}
        def refs(pile):
            keys=[]
            for _,key,raw in sorted(pile,reverse=True):
                candidates[key]=json.loads(raw);keys.append(key)
            return keys
        intro=refs(piles[k])
        policies=[]
        for v in allread:
            ids=refs(piles[k,v])
            stage=stages.get((k,v),{})
            count=len(coverage[k,v])
            # Cap contributions per entry; the leading word cannot determine the tier alone.
            broad=sum(1 for ident in {candidates[key]["id"] for key in ids
                if any(rank is not None and rank<=10000 for rank in candidates[key]["ranks"])
                and candidates[key]["reading_evidence"] and candidates[key]["matched"][v].get("basis")=="exact segment" and not candidates[key]["flags"]})
            illustrative=bool(v in official and gov[k]["examples_by_reading"][official.index(v)])
            tier="secondary" if v in official or count>=3 else "reference-only"
            if v in official and not stage.get("limited_usage") and stage.get("stage")=="elementary" and count>=3 and broad>=2 and illustrative:
                tier="preferred"
            policy_counts[tier]+=1
            policies.append(dict(reading=v,official=v in official,stage=stage.get("stage"),
                limited=stage.get("limited_usage"),category=tier,priority=None,reviewedOverride=None,
                supported_entries=count,frequent_unflagged_examples=broad,current_support=v in current_support[k],candidates=ids))
        existing=[audit_by_id[i] for i in current[k]]
        for a in existing:
            if (a["issues"] or a["flags"]) and intro:
                a.setdefault("alternatives_by_kanji",{})[k]=[key for key in intro if candidates[key]["form"]!=a["form"]][:3]
        g=grades[k]
        save(HERE/"kanji"/f"grade-{g}"/(k+".json"),dict(character=k,grade=g,meanings=rec["englishMeanings"],
             strokes=kd[k]["misc"]["strokeCounts"],radicals=kd[k]["radicals"],components=parts.get(k),
             on=rec["onyomi"],kun=rec["kunyomi"],nanori=rec["nanori"],government=gov[k],
             supplementary=[r for r in appendix if any(k in f for f in r["forms"])],
             readings=policies,handwriting_candidates=intro,candidates=candidates,existing=existing,
             unassigned_form_count=unsupported[k]))
    for i in range(0,len(audit),100):
        save(HERE/"deck"/f"{i+1:04}.json",audit[i:i+100])
    save(HERE/"quality.json",dict(kanji=len(app),deck=len(audit),provisional_readings=policy_counts,
        mapping_status=Counter(a["mapping"] for a in audit),audit_flags=Counter(v for a in audit for v in a["flags"]+a["issues"]),
        table_counts={t:con.execute("SELECT count(*) FROM "+t).fetchone()[0] for t in ["entry","form","segmentation","evidence","scoring"]}))
    con.close()

if __name__=="__main__":main()
