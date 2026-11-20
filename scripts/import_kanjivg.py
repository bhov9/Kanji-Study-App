"""Extract canonical Jōyō stroke paths from a local KanjiVG Git checkout."""

import argparse
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG = '{http://www.w3.org/2000/svg}'


def extract(source, character):
    code = f'{ord(character):05x}'
    file = source / 'kanji' / f'{code}.svg'
    if not file.is_file():
        return None
    svg = ET.parse(file).getroot()
    if svg.get('viewBox') != '0 0 109 109':
        raise ValueError(f'Unexpected view box in {file}')
    group = svg.find(f"{SVG}g[@id='kvg:StrokePaths_{code}']")
    if group is None:
        raise ValueError(f'Missing stroke group in {file}')
    paths = []
    for index, path in enumerate(group.iter(f'{SVG}path'), 1):
        if path.get('id') != f'kvg:{code}-s{index}' or not path.get('d'):
            raise ValueError(f'Unexpected stroke ID or absent path in {file}')
        paths.append(path.get('d'))
    if not paths:
        raise ValueError(f'No strokes in {file}')
    return paths


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    source = parser.parse_args().source
    revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    curriculum = (ROOT / 'curriculum.js').read_text(encoding='utf-8')
    characters = ''.join(json.loads(re.search(r'const charactersByGrade = (\[.*?\]);', curriculum, re.S)[1]))
    shards = [{} for _ in range(32)]
    missing = []
    for character in characters:
        paths = extract(source, character)
        if paths:
            shards[ord(character) % len(shards)][character] = paths
        else:
            missing.append(character)
    output = ROOT / 'stroke-data'
    output.mkdir(exist_ok=True)
    for index, shard in enumerate(shards):
        rows = [f'  {json.dumps(character, ensure_ascii=False)}:{json.dumps(paths, separators=(",", ":"))}'
                for character, paths in shard.items()]
        (output / f'{index:02x}.json').write_text('{\n' + ',\n'.join(rows) + '\n}\n',
                                                 encoding='utf-8', newline='\n')
    license_text = (source / 'COPYING').read_text(encoding='utf-8').rstrip() + '\n'
    (output / 'KANJIVG-LICENSE.txt').write_text(license_text, encoding='utf-8', newline='\n')
    notice = (
        '# KanjiVG stroke data\n\n'
        'Copyright © Ulrich Apel and KanjiVG contributors. Derived from [KanjiVG](https://kanjivg.tagaini.net/) '
        'and distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). '
        'See [KANJIVG-LICENSE.txt](KANJIVG-LICENSE.txt).\n\n'
        f'[Source revision](https://github.com/KanjiVG/kanjivg/tree/{revision}). '
        'The JSON files retain only the ordered paths of the canonical Japanese SVGs. '
        'No variant paths are substituted.\n\n'
        f'Coverage: {len(characters) - len(missing):,} of {len(characters):,} Jōyō kanji. '
        f'Missing: {", ".join(missing) if missing else "none"}.\n'
    )
    (output / 'README.md').write_text(notice, encoding='utf-8', newline='\n')
    print(f'Coverage: {len(characters) - len(missing)}/{len(characters)}. '
          f'Missing: {", ".join(f"U+{ord(character):04X}" for character in missing) or "none"}')


if __name__ == '__main__':
    main()
