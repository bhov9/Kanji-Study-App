"""Extract unique, character-aligned readings from a JmdictFurigana release."""

import argparse
from collections import defaultdict
import json
from pathlib import Path
import subprocess
import tarfile


ROOT = Path(__file__).resolve().parents[1]


def character_parts(entry):
    parts = []
    for segment in entry['furigana']:
        spelling = segment['ruby']
        if 'rt' in segment:
            if len(spelling) != 1 or not segment['rt']:
                return None
            parts.append(segment['rt'])
        else:
            parts.extend(spelling)
    if ''.join(segment['ruby'] for segment in entry['furigana']) == entry['text'] and ''.join(parts) == entry['reading']:
        return tuple(parts)
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('release')
    args = parser.parse_args()
    rows = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e',
         "import {gradeVocabulary} from './grade-vocabulary.js'; console.log(JSON.stringify(gradeVocabulary));"],
        cwd=ROOT, encoding='utf-8',
    ))
    missing = {(row[1], row[2]): row[0] for row in rows if len(row) == 4}
    matches = defaultdict(set)
    with tarfile.open(args.archive) as archive:
        with archive.extractfile('JmdictFurigana.json') as stream:
            entries = json.load(stream)
    for entry in entries:
        key = entry['text'], entry['reading']
        if key in missing:
            matches[key].add(character_parts(entry))
    mappings = {
        missing[key]: list(next(iter(parts))) for key, parts in sorted(matches.items())
        if len(parts) == 1 and None not in parts
    }
    source = 'https://github.com/Doublevil/JmdictFurigana/releases/tag/' + args.release
    lines = [
        '// Derived from JmdictFurigana (Doublevil) and JMdict (EDRDG, James William Breen).',
        '// CC BY-SA 4.0. See THIRD-PARTY-NOTICES.md.',
        f'export const furiganaSource = {json.dumps(source)};',
        'export const readingMappings = {',
        *(f'  {json.dumps(key, ensure_ascii=False)}: {json.dumps(parts, ensure_ascii=False)},'
          for key, parts in mappings.items()),
        '};\n',
    ]
    (ROOT / 'reading-mappings.js').write_text('\n'.join(lines), encoding='utf-8', newline='\n')
    print(f'{len(mappings)} exact word matches added; {len(missing) - len(mappings)} rows still have no imported mapping.')


if __name__ == '__main__':
    main()
