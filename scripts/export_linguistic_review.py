"""Export the current app data with metadata from its pinned dictionary snapshots."""

import argparse
import csv
import gzip
import json
from pathlib import Path
import subprocess
import unicodedata
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
KANJIDIC = 'https://www.edrdg.org/wiki/KANJIDIC_Project.html'
JMDICT = 'https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html'
JOYO = 'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/'
MEXT = 'https://www.mext.go.jp/content/20230120-mxt_kyoiku02-100002604_01.pdf'


def unicode_id(character):
    return f'U+{ord(character):04X}'


def kana(text):
    return ''.join(chr(ord(c) - 96) if 'ァ' <= c <= 'ヶ' else c for c in unicodedata.normalize('NFC', text))


def jmdict_priorities(archive, words):
    requested = {}
    for word in words:
        if word['id'].startswith('jmdict:'):
            requested.setdefault(word['id'].split(':')[1], []).append(word)
    priorities = {}
    with gzip.open(archive) as stream:
        for _, entry in ET.iterparse(stream, events=('end',)):
            if entry.tag != 'entry':
                continue
            for word in requested.get(entry.findtext('ent_seq'), []):
                written = [element for element in entry.findall('k_ele') if element.findtext('keb') == word['spelling']]
                spoken = [element for element in entry.findall('r_ele') if kana(element.findtext('reb', '')) == word['reading']
                          and not element.findall('re_nokanji')
                          and (not element.findall('re_restr') or word['spelling'] in
                               [item.text for item in element.findall('re_restr')])]
                if written and spoken:
                    flags = sorted({flag.text for element in written + spoken
                                    for flag in element.findall('ke_pri') + element.findall('re_pri') if flag.text})
                    priorities[word['id']] = {
                        'flags': flags,
                        'frequencyBand': min((int(flag[2:]) for flag in flags if flag.startswith('nf')), default=None),
                        'usageFlags': sorted({flag.text for element in written + spoken
                                              for flag in element.findall('ke_inf') + element.findall('re_inf') if flag.text}),
                    }
            entry.clear()
    return priorities


def write_export(directory, name, rows):
    (directory / f'{name}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (directory / f'{name}.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\n')
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else value
                             for key, value in row.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kanjidic', type=Path, help='Original KANJIDIC2 .xml.gz snapshot')
    parser.add_argument('jmdict', type=Path, help='Original JMdict_b.gz snapshot')
    args = parser.parse_args()
    data = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
        import { words } from './data.js';
        import { curriculumGrades } from './curriculum.js';
        import { kanjiReference } from './kanji-reference.js';
        console.log(JSON.stringify({ words, grades: [...curriculumGrades], reference: kanjiReference }));
    '''], cwd=ROOT, encoding='utf-8'))
    with gzip.open(args.kanjidic) as stream:
        dictionary = ET.parse(stream)
    frequencies = {entry.findtext('literal'): int(entry.findtext('misc/freq'))
                   for entry in dictionary.findall('character') if entry.find('misc/freq') is not None}
    words = data['words']
    priorities = jmdict_priorities(args.jmdict, words)
    deck = {character: [] for character, _ in data['grades']}
    vocabulary = []
    for word in words:
        spelling, reading = word['spelling'], word['reading']
        parts = word.get('readingParts')
        positions = [{'position': i + 1, 'written': c, 'kanjiId': c if c in deck else None,
                      'kana': parts[i] if parts else reading if len(spelling) == 1 else None}
                     for i, c in enumerate(spelling)]
        for character in word['characters']:
            deck[character].append(word['id'])
        vocabulary.append({
            'wordId': word['id'], 'spelling': spelling, 'hiragana': reading, 'englishMeaning': word['meaning'],
            'kanjiIds': word['characters'], 'grades': word['grades'], 'readingMapping': positions,
            'mappingStatus': 'mapped' if parts or len(spelling) == 1 else 'needs-review',
            'mappingSource': word['readingMappingSource'] or ('Whole reading of single character' if len(spelling) == 1 else None),
            'dictionaryPriority': priorities.get(word['id']), 'appPriorityRank': None,
            'source': JMDICT if word['id'].startswith('jmdict:') else 'App starter deck (data.js)',
        })
    kanji = []
    for character, grade in data['grades']:
        reference = data['reference'].get(character, {})
        kun = []
        for reading in reference.get('kun', []):
            stem, _, suffix = reading.partition('.')
            kun.append({'sourceNotation': reading, 'stem': stem, 'okurigana': suffix or None})
        kanji.append({
            'character': character, 'unicode': unicode_id(character), 'kanjiId': character,
            'grade': grade, 'englishMeanings': reference.get('meanings'), 'onyomi': reference.get('on'),
            'kunyomi': kun, 'nanori': reference.get('names'), 'kanjidicFrequency': frequencies.get(character),
            'preferredStudyReadings': None, 'secondaryStudyReadings': None, 'referenceOnlyReadings': None,
            'readingPriorityRanks': None, 'selectedWordIds': deck[character],
            'sources': {'curriculum': MEXT if grade <= 6 else JOYO, 'dictionary': KANJIDIC},
        })
    directory = ROOT / 'linguistic-review'
    directory.mkdir(exist_ok=True)
    write_export(directory, 'kanji', kanji)
    write_export(directory, 'vocabulary', vocabulary)
    print(f'{len(kanji)} kanji, {len(vocabulary)} vocabulary entries, '
          f'{sum(row["mappingStatus"] == "needs-review" for row in vocabulary)} unmapped words')


if __name__ == '__main__':
    main()
