"""Regenerate the browser reference from the latest EDRDG KANJIDIC2 XML."""

import argparse
import gzip
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz'


def unique(values):
    return list(dict.fromkeys(values))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', type=Path, help='Use an already downloaded .xml.gz')
    args = parser.parse_args()
    if args.archive:
        compressed = args.archive.read_bytes()
    else:
        with urlopen(SOURCE, timeout=30) as response:
            compressed = response.read()
    dictionary = ET.fromstring(gzip.decompress(compressed))

    curriculum = (ROOT / 'curriculum.js').read_text(encoding='utf-8')
    groups = json.loads(re.search(r'const charactersByGrade = (\[.*?\]);', curriculum, re.S)[1])
    characters = ''.join(groups)
    character_set = set(characters)
    if len(characters) != 2136 or len(character_set) != 2136:
        raise ValueError('Expected exactly 2,136 unique curriculum characters')

    by_character = {}
    for entry in dictionary.findall('character'):
        character = entry.findtext('literal')
        if character not in character_set:
            continue
        readings = entry.findall('reading_meaning/rmgroup/reading')
        meanings = entry.findall('reading_meaning/rmgroup/meaning')
        by_character[character] = {
            'meanings': unique(item.text for item in meanings if item.text and 'm_lang' not in item.attrib),
            'on': unique(item.text for item in readings if item.text and item.get('r_type') == 'ja_on'),
            'kun': unique(item.text for item in readings if item.text and item.get('r_type') == 'ja_kun'),
            'names': unique(item.text for item in entry.findall('reading_meaning/nanori') if item.text),
        }
    missing = character_set - by_character.keys()
    if missing:
        raise ValueError('Missing dictionary records: ' + ''.join(sorted(missing)))
    source_date = dictionary.findtext('header/date_of_creation')
    lines = [
        '// Adapted from KANJIDIC2, copyright James William Breen and EDRDG.',
        '// CC BY-SA 4.0: https://www.edrdg.org/edrdg/licence.html',
        f'// KANJIDIC2 source snapshot: {source_date}. Regenerate with scripts/update_kanji_reference.py.',
        'export const kanjiReference = {',
    ]
    for character in characters:
        data = json.dumps(by_character[character], ensure_ascii=False, separators=(',', ':'))
        lines.append(f'  "{character}": {data},')
    lines.append('};\n')
    (ROOT / 'kanji-reference.js').write_text('\n'.join(lines), encoding='utf-8', newline='\n')
    print(f'Imported {len(by_character)} KANJIDIC2 records from {source_date}.')


if __name__ == '__main__':
    main()
