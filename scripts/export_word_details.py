"""Export form-restricted, licensed dictionary details for the shared production deck."""
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tarfile

from export_linguistic_review import ROOT, kana

research = Path(sys.argv[1]).resolve()
manifest = json.loads((research / "sources.json").read_text("utf-8"))
archive_name = "jmdict-eng-3.6.2+20261123231529.json.tgz"
with tarfile.open(research / "package/raw" / archive_name) as tar:
    member = next(m for m in tar if m.name.endswith(".json"))
    header = tar.extractfile(member).read(150000).decode("utf-8", errors="ignore")
    tags, _ = json.JSONDecoder().raw_decode(header.split('"tags":', 1)[1].lstrip())
db = sqlite3.connect((research / "local/curriculum-research.sqlite").as_uri() + "?mode=ro", uri=True)
db.create_function("kana", 1, kana)
words = json.loads(subprocess.check_output(["node", "--input-type=module", "-e",
    "import {words} from './data.js';console.log(JSON.stringify(words.map(({id,spelling,reading})=>({id,spelling,reading}))))"], cwd=ROOT))
priority = {w["wordId"]: w["dictionaryPriority"] for w in json.loads(
    (ROOT / "linguistic-review/vocabulary.json").read_text("utf-8"))}
details = {}
for word in words:
    key, spelling, reading = (word[k] for k in ("id","spelling","reading"))
    rows = db.execute("SELECT id, sense_indices, dictionary_json FROM form JOIN entry USING(id) "
                      "WHERE spelling=? AND kana(reading)=?", (spelling, kana(reading))).fetchall()
    owners = {r[0] for r in rows}
    ident = int(key.split(":")[1]) if key.startswith("jmdict:") else next(iter(owners)) if len(owners)==1 else None
    meta = {}
    selected = [r for r in rows if r[0] == ident]
    if selected:
        record = json.loads(selected[0][2])
        meta["jmdictId"] = ident
        meta["senses"] = []
        for index in sorted({i for row in selected for i in json.loads(row[1])}):
            sense = record["sense"][index]
            meta["senses"].append(dict(index=index, glosses=[g["text"] for g in sense["gloss"] if g["lang"]=="eng"],
                pos=[tags.get(t,t) for t in sense["partOfSpeech"]],
                labels=[tags.get(t,t) for t in sense["misc"]+sense["dialect"]]))
    splits = set()
    for raw, in db.execute("SELECT segments FROM segmentation WHERE spelling=? AND reading=?", (spelling,reading)):
        segments = json.loads(raw)
        if "".join(x["ruby"] for x in segments)!=spelling or "".join(x.get("rt",x["ruby"]) for x in segments)!=reading:
            continue
        if any("rt" in x and len(x["ruby"])!=1 for x in segments):
            splits.add(())
        else:
            splits.add(tuple(v for x in segments for v in ([x["rt"]] if "rt" in x else list(x["ruby"]))))
    if len(splits)==1 and next(iter(splits)):
        meta["verifiedParts"] = list(next(iter(splits)))
    if priority.get(key):
        meta["dictionaryPriority"] = priority[key]
    details[key] = meta
def export(name, value):
    (ROOT / name).write_text(value,encoding="utf-8")
export("word-details.js","// JMdict and JmdictFurigana adaptations · CC BY-SA 4.0. See THIRD-PARTY-NOTICES.md.\nexport const wordDetails = {\n" +
       ",\n".join("  "+json.dumps(k,ensure_ascii=False)+": "+json.dumps(v,ensure_ascii=False,separators=(",",":")) for k,v in details.items())+"\n};\n")
export("linguistic-review/word-detail-sources.json",json.dumps([dict(file=s["file"],url=s["url"],sha256=s["sha256"],license="CC BY-SA 4.0")
       for s in manifest if s["file"] in (archive_name,"JmdictFurigana.json")],indent=2)+"\n")
