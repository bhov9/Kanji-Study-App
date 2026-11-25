"""Download public source files without running any code from the archives."""
import hashlib
import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

HERE = Path(__file__).resolve().parent
RAW = HERE.parent / "local/supplement"
BUNKA = "https://www.bunka.go.jp/"
REP = BUNKA + "seisaku/kokugo_nihongo/kokugo_shisaku/joyokanjihyo_sakuin/"
NINJAL = "https://repository.ninjal.ac.jp/record/"
URLS = {
    "joyo.html": BUNKA + "kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/joyokanjisakuin/index.html",
    "representative.html": REP + "index.html",
    "mext.pdf": "https://www.mext.go.jp/a_menu/shotou/new-cs/__icsFiles/afieldfile/2017/05/15/1385768.pdf",
    "short.zip": NINJAL + "3235/files/BCCWJ_frequencylist_suw_ver1_1.zip",
    "long.zip": NINJAL + "3229/files/BCCWJ_frequencylist_luw_ver1_1.zip",
    "textbooks.zip": NINJAL + "3301/files/LR-CCG-10-07-CD-ROM.zip",
}


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    lock = HERE / "manifest.json"
    previous = json.loads(lock.read_text("utf8")) if lock.exists() else {}
    with urllib.request.urlopen("https://pypi.org/pypi/wordfreq/3.1.1/json", timeout=60) as res:
        wheel, = [r for r in json.load(res)["urls"] if r["filename"].endswith(".whl")]
    sources = dict(URLS, **{"wordfreq.whl": wheel["url"]})
    manifest = {}
    while sources:
        name = next(iter(sources))
        url = sources.pop(name)
        path = RAW / name
        wanted = previous.get(name, {}).get("sha256")
        if path.exists():
            data = path.read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=180) as res:
                data = res.read()
        checksum = hashlib.sha256(data).hexdigest()
        if name == "wordfreq.whl":
            assert checksum == wheel["digests"]["sha256"]
        if wanted and checksum != wanted:
            raise ValueError(f"Snapshot changed: {name}")
        if not path.exists():
            path.write_bytes(data)
        manifest[name] = dict(url=url, sha256=checksum, bytes=len(data))
        if name == "representative.html":
            links = sorted(set(re.findall(rb'table_[\w]+\.html', data)))
            assert links
            sources.update({v.decode(): urljoin(REP,v.decode()) for v in links})
    lock.write_text(json.dumps(manifest, indent=2) + "\n", "utf8")


if __name__ == "__main__":
    main()
