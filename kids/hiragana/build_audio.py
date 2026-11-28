"""Rebuild the bundled MP3 ranges from the pinned, attributed kana map."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
REV = "6de3a8ad639b29ad2e58276e6ef51038591cb95f"
BASE = f"https://huggingface.co/datasets/arsalan-anwari/kana-sounds/resolve/{REV}/"


def fetch(path):
    for attempt in range(4):
        try:
            with urlopen(BASE + path, timeout=40) as response:
                return response.read()
        except OSError:
            if attempt == 3:
                raise
            time.sleep(1 + attempt)


def main():
    card = fetch("README.md").decode()
    assert "license: cc-by-4.0" in card
    rows = re.findall(r"^\| [^|]+ \| ([ぁ-ゖ]+) \| [^|]+ \| [^|]+ \| `(audio/(?:seion|dakuon|handakuon|yoon)/\w+\.mp3)` \|", card, re.M)
    assert len(rows) == len(dict(rows)) == 104
    audio, index = bytearray(), {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for (kana, path), clip in zip(rows, pool.map(fetch, [path for _, path in rows])):
            assert clip.startswith(b"ID3") or clip[0] == 255, path
            index[kana] = [len(audio), len(clip), path]
            audio.extend(clip)
    (ROOT / "clips.bin").write_bytes(audio)
    (ROOT / "clips.js").write_text("export const clips = " + json.dumps(index, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"{len(index)} clips, {len(audio)} bytes")


if __name__ == "__main__":
    main()
