"""Restore the audited source snapshot with Python 3.11+."""
import hashlib
import json
import pathlib
import shutil
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
RAW = ROOT / "package/raw"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    errors = []
    for item in json.loads((ROOT / "sources.json").read_text("utf8")):
        path = RAW / item["file"]
        if path.exists() and digest(path) == item["sha256"]:
            continue
        temp = None
        try:
            with tempfile.NamedTemporaryFile(dir=RAW, delete=False) as out:
                temp = pathlib.Path(out.name)
                with urllib.request.urlopen(item["url"], timeout=120) as source:
                    shutil.copyfileobj(source, out)
            if digest(temp) != item["sha256"]:
                raise ValueError("Source differs from the audited snapshot")
            temp.replace(path)
        except (OSError, ValueError) as exc:
            errors.append(f"{path.name}: {exc}")
        finally:
            if temp:
                temp.unlink(missing_ok=True)
    if errors:
        raise SystemExit("\n".join(errors))


if __name__ == "__main__":
    main()
