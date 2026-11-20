"""Select a supplemental word for each Jōyō kanji without starter vocabulary."""

import argparse
import gzip
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KANA = re.compile(r'^[ぁ-ゖァ-ヺー]+$')
CORE = {'ichi1', 'news1', 'spec1', 'gai1'}
UNSUITABLE = ('obsolete', 'archaic', 'vulgar', 'derogatory', 'sensitive',
              'jocular', 'rare term', 'NET slang', 'dated term')


def hiragana(text):
    return ''.join(chr(ord(char) - 0x60) if 'ァ' <= char <= 'ヶ' else char for char in text)


def readings(reference, spelling, reading):
    options = []
    for character in spelling:
        if character not in reference:
            options.append([hiragana(character)])
            continue
        entry = reference[character]
        candidates = entry['on'] + [value.split('.')[0] for value in entry['kun']]
        options.append(sorted({hiragana(value) for value in candidates if KANA.fullmatch(value)}))
    if sum(character in reference for character in spelling) == 1:
        index = next(index for index, char in enumerate(spelling) if char in reference)
        prefix, suffix = hiragana(spelling[:index]), hiragana(spelling[index + 1:])
        end = len(reading) - len(suffix)
        if reading.startswith(prefix) and reading.endswith(suffix) and end > len(prefix):
            return [*prefix, reading[len(prefix):end], *suffix]

    def split(index, remaining):
        if index == len(options):
            if not remaining:
                yield []
            return
        for value in options[index]:
            if remaining.startswith(value):
                for tail in split(index + 1, remaining[len(value):]):
                    yield [value, *tail]

    matches = split(0, reading)
    first = next(matches, None)
    return first if first and next(matches, None) is None else None


def glosses(entry, spelling, reading):
    for sense in entry.findall('sense'):
        restrictions = sense.findall('stagk')
        if restrictions and all(item.text != spelling for item in restrictions):
            continue
        restrictions = sense.findall('stagr')
        if restrictions and all(item.text != reading for item in restrictions):
            continue
        # The curriculum includes 朕, whose standard dictionary sense is historical.
        if spelling != '朕' and any(any(flag in (item.text or '') for flag in UNSUITABLE)
                                   for item in sense.findall('misc')):
            continue
        values = [item.text for item in sense.findall('gloss') if item.text and len(item.text) <= 90]
        if values:
            note = sense.findtext('s_inf') if spelling == '朕' else None
            return '; '.join(values[:2]) + (f' ({note})' if note else '')
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Official EDRDG JMdict_b.gz')
    source = parser.parse_args().source
    curriculum = (ROOT / 'curriculum.js').read_text(encoding='utf-8')
    grade_groups = json.loads(re.search(r'const charactersByGrade = (\[.*?\]);', curriculum, re.S)[1])
    grades = {char: grade for grade, group in enumerate(grade_groups, 1) for char in group}
    reference_file = (ROOT / 'kanji-reference.js').read_text(encoding='utf-8')
    reference = dict(json.loads('[' + line.strip().replace('": {', '", {', 1).rstrip(',') + ']')
                     for line in reference_file.splitlines() if line.startswith('  "'))
    starter = (ROOT / 'data.js').read_text(encoding='utf-8').split('const wordRows = [', 1)[1].split('];', 1)[0]
    known = {char for spelling in re.findall(r"\['[^']+', '([^']+)'", starter) for char in spelling}
    best = {}
    with gzip.open(source) as stream:
        for _, entry in ET.iterparse(stream, events=('end',)):
            if entry.tag != 'entry':
                continue
            sequence = entry.findtext('ent_seq')
            for written in entry.findall('k_ele'):
                spelling = written.findtext('keb') or ''
                characters = set(spelling) & grades.keys()
                if not characters - known or len(spelling) > 6:
                    continue
                if any(char not in grades and not KANA.fullmatch(char) for char in spelling):
                    continue
                for spoken in entry.findall('r_ele'):
                    reading = spoken.findtext('reb') or ''
                    restrictions = spoken.findall('re_restr')
                    if not KANA.fullmatch(reading) or spoken.find('re_nokanji') is not None:
                        continue
                    if restrictions and all(item.text != spelling for item in restrictions):
                        continue
                    flags = {item.text for item in written.findall('ke_pri') + spoken.findall('re_pri')}
                    commonness = min([int(flag[2:]) for flag in flags if flag and re.fullmatch(r'nf\d+', flag)] or [99])
                    meaning = None
                    for char in characters - known:
                        locked = sum(grades[other] > grades[char] for other in characters)
                        rank = (locked, not bool(flags & CORE), commonness,
                                bool(written.findall('ke_inf') or spoken.findall('re_inf')),
                                len(characters), len(spelling), len(reading))
                        if char in best and best[char][0] <= rank:
                            continue
                        meaning = meaning or glosses(entry, spelling, reading)
                        if meaning:
                            best[char] = (rank, (sequence, spelling, hiragana(reading), meaning))
            entry.clear()

    rows = sorted({row for _, row in best.values()})
    output = [
        '// Adapted from EDRDG JMdict, licensed CC BY-SA 4.0. See README.md.',
        '// JMdict_b.gz SHA-256: ' + hashlib.sha256(source.read_bytes()).hexdigest(),
        'export const gradeVocabulary = [',
    ]
    for sequence, spelling, reading, meaning in rows:
        word_id = f'jmdict:{sequence}:{spelling}:{reading}'
        row = [word_id, spelling, reading, meaning]
        parts = readings(reference, spelling, reading)
        if parts:
            row.append(parts)
        output.append('  ' + json.dumps(row, ensure_ascii=False) + ',')
    output.append('];\n')
    (ROOT / 'grade-vocabulary.js').write_text('\n'.join(output), encoding='utf-8', newline='\n')
    missing = grades.keys() - known - best.keys()
    print(f'{len(rows)} words; {len(missing)} uncovered: ' + ' '.join(f'U+{ord(char):04X}' for char in sorted(missing)))


if __name__ == '__main__':
    main()
