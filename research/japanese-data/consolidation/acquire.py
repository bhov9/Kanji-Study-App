"""Fetch the public prebuilt Jiten lists. Retain exact response bytes compressed."""
import csv
import io
import gzip
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent
DIR = ROOT / "jiten"
DIR.mkdir(exist_ok=True)
manifest = DIR / "manifest.json"
rows = json.loads(manifest.read_text("utf8")) if manifest.exists() else []
for key in ["global", *range(1,12), "kanji"]:
    name = f"{key}.csv.gz"
    path = DIR / name
    prior = next((r for r in rows if r["file"] == name),None)
    if prior and path.exists():
        assert hashlib.sha256(gzip.decompress(path.read_bytes())).hexdigest() == prior["sha256"]
        continue
    url = "https://api.jiten.moe/api/frequency-list/download"
    if key == "kanji":
        url += "-kanji"
    url += "?downloadType=csv"
    if isinstance(key,int):
        url += f"&mediaType={key}"
    for attempt in range(4):
        try:
            with urlopen(url,timeout=120) as response:
                raw = response.read()
                filename = response.headers.get("Content-Disposition")
                modified = response.headers.get("Last-Modified")
            break
        except HTTPError as exc:
            if exc.code != 429 or attempt == 3:
                raise
            time.sleep(int(exc.headers.get("Retry-After","65")))
    stream = csv.reader(io.StringIO(raw.decode("utf-8-sig")))
    header = next(stream)
    assert len(header)>1
    path.write_bytes(gzip.compress(raw,mtime=0))
    rows.append(dict(file=name, url=url, retrieved=datetime.now(timezone.utc).isoformat(),
                     upstream_filename=filename, modified=modified, bytes=len(raw),
                     sha256=hashlib.sha256(raw).hexdigest(), header=header, records=sum(1 for _ in stream)))
    manifest.write_text(json.dumps(rows,indent=2,ensure_ascii=False)+"\n","utf8")
    print(key,filename,header,flush=True)
    time.sleep(7)
