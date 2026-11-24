# Linguistic review data

- `kanji.json` / `kanji.csv` contain all 2,136 Jōyō kanji. The character is the stable internal ID. Word IDs join to the vocabulary export.
- `vocabulary.json` / `vocabulary.csv` contain the current deck with kana aligned to written code points where available. Filter `mappingStatus` for `needs-review` to find unresolved readings without guessing their boundaries.
- JSON uses `null` for unavailable fields. CSV uses empty cells for these values and JSON-encoded cells for arrays and objects. An empty list represents a field with no values in the source record.
- [`reading-policy.schema.json`](reading-policy.schema.json) defines a separate format for future reviewed decisions. Use one record per kanji and reading, choose a category, and use smaller priority numbers for higher priority. Cite the evidence for overrides. Join preferred examples by stable word ID. This schema is separate from dictionary data and has no effect on the current deck.

## How study selects words

The starter deck is an ordered list with authored spellings, readings, and cues in `data.js`. Its entries have no recorded reading or word-frequency ranks. The supplemental JMdict importer chooses entries for characters absent from the starter deck, comparing candidates in this order:

1. Fewer characters from higher grades.
2. A core JMdict priority marker.
3. A better JMdict newspaper frequency band.
4. No flagged spelling or reading usage.
5. Fewer distinct kanji, then shorter spelling, then shorter reading.

Those comparisons are used at import time. The selected words are pooled and deduplicated, with no per-reading preference or persistent rank. The vocabulary export preserves matching JMdict priority and usage flags from the source snapshot. KANJIDIC2 frequency is a character-level field, separate from word and reading frequencies.

At runtime, the scheduler picks vocabulary containing due or currently unlocked new kanji. It handles review spacing and grade availability, then randomly selects among eligible candidates, preferring familiar spellings when available. A word's Japanese reading comes from its deck entry. The scheduler does not choose among the dictionary readings for an individual character.

Kana boundaries come from the starter deck, the original importer's unique KANJIDIC2 alignment, or a matching JmdictFurigana spelling and reading whose source segments align to single written characters. JmdictFurigana output is automatically generated upstream and can still contain errors. Inseparable or missing mappings retain the positional cue for a partial test. KANJIDIC2 supplies the dictionary readings, okurigana boundaries, and nanori. Its Japanese reading records do not label rarity or Jōyō status.

## Reproduce the exports

Run `python scripts/export_linguistic_review.py PATH_TO_KANJIDIC2_XML_GZ PATH_TO_JMDICT_B_GZ` with Node.js on the path. Use the KANJIDIC2 snapshot dated 2026-11-20 and the JMdict archive whose SHA-256 appears in `grade-vocabulary.js`. Use the same archive release recorded in `reading-mappings.js` if regenerating those mappings.

Dictionary-derived portions of the exports are CC BY-SA 4.0, with credits and adaptation details in [Sources and license notices](../THIRD-PARTY-NOTICES.md) and the [license text](../licenses/CC-BY-SA-4.0.txt).
