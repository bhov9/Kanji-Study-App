# Sources and license notices

## Curriculum

- [常用漢字表 (2010 Cabinet Notification No. 2)](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/), published by Japan’s Agency for Cultural Affairs, supplies the 2,136 characters. The app extracts the characters and regroups them in `curriculum.js`. The notice also includes official standard readings. The readings in Kanji Details come from KANJIDIC2.
- [Elementary School Course of Study (2017), grade allocation appendix](https://www.mext.go.jp/content/20230120-mxt_kyoiku02-100002604_01.pdf), published by Japan’s Ministry of Education, Culture, Sports, Science and Technology (MEXT), supplies the character assignments for Grades 1–6. The app reformats the groupings and places the remaining Jōyō characters in a seventh group.
- [The promulgation of the Gakusei](https://www.mext.go.jp/b_menu/hakusho/html/others/detail/mext_03459.html), published by MEXT, is the reference for the short, paraphrased historical note in `examples.js`.

The [Agency’s website policy](https://www.bunka.go.jp/bunkacho_homepage/) refers users to the [MEXT website reuse terms](https://www.mext.go.jp/b_menu/1351168.htm) for its content. Those terms permit redistribution and adaptation of covered materials, including commercial reuse, and ask for source credit and identification of edits. The app uses the government lists and a historical fact from these sources. Its extracted groupings and paraphrase are app edits.

The [NIER HTML grade table](https://erid.nier.go.jp/files/COFS/h29e/chap2-1.htm) and [Project X0213 code table](https://x0213.org/joyo-kanji-code/index.html) were used for cross-checking. The app distributes the character and grade data from the official government tables. It ships neither comparison file nor Project X0213’s encoding mappings.

The official example panel adapts the reading-specific example lists from the Agency’s 2010 Jōyō table under the government reuse terms above. Its stroke counts are calculated from the bundled KanjiVG paths credited below.

## Dictionary data

Copyright © James William Breen and the Electronic Dictionary Research and Development Group (EDRDG). EDRDG’s [dictionary license and attribution terms](https://www.edrdg.org/edrdg/licence.html) permit copying, redistribution, and adaptation under [Creative Commons Attribution-ShareAlike 4.0 International](licenses/CC-BY-SA-4.0.txt). The bundled adaptations below are distributed under the same license.

- [JMdict project documentation](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) and [upstream files](https://www.edrdg.org/pub/Nihongo/). `grade-vocabulary.js` selects spellings, readings, and English glosses from `JMdict_b.gz`, formats them as study prompts, and adds kana-to-character alignment where available. The file header records the archive’s SHA-256, and `scripts/import_grade_vocabulary.py` documents the selection and conversion.
- [KANJIDIC project documentation](https://www.edrdg.org/wiki/KANJIDIC_Project.html) and [KANJIDIC2 file documentation](https://www.edrdg.org/kanjidic/kanjd2index_legacy.html). `kanji-reference.js` filters the XML to the Jōyō characters and reformats the Japanese on and kun readings and English glosses as JavaScript. The file header records the snapshot date, and `scripts/update_kanji_reference.py` records the upstream download and conversion.

- [JmdictFurigana release 2.3.1+2026-10-25](https://github.com/Doublevil/JmdictFurigana/releases/tag/2.3.1%2B2026-10-25), by Doublevil, supplies word-specific furigana derived from JMdict. The project licenses its dataset under the same CC BY-SA terms as JMdict. `reading-mappings.js` adapts that dataset into per-character kana arrays for existing words with missing mappings and is distributed under [CC BY-SA 4.0](licenses/CC-BY-SA-4.0.txt). The MIT-licensed generator code and the separate name dataset are outside this import.

The seven added teaching forms and the word-detail layer use the English JMdict snapshot distributed by [jmdict-simplified](https://github.com/scriptin/jmdict-simplified). Glosses, sense-specific parts of speech and usage labels are restricted to the written and spoken form. Reading splits are drawn from JmdictFurigana only where each character aligns and the parts reconstruct the pronunciation. Newspaper frequency bands and form usage labels come from the production JMdict review export. The [source manifest](linguistic-review/word-detail-sources.json) records upstream versions and hashes. These dictionary data adaptations are CC BY-SA 4.0.

The full offline English dictionary is adapted from EDRDG JMdict via jmdict-simplified 3.6.2+20261123231529. Entry IDs, form and sense restrictions, English glosses and usage tags are retained in compressed records. The search and preview indexes are derived from these records. The compound examples combine JMdict common-form markers with JmdictFurigana 2.3.1+2026-10-25. These data and derived indexes are distributed under CC BY-SA 4.0. See the [pinned dictionary manifest](dictionary/3.6.2+20261123231529/manifest.json) and the [furigana source and checksum](linguistic-review/word-detail-sources.json).

## Stroke-order data

[KanjiVG](https://github.com/KanjiVG/kanjivg#licence) is copyright © Ulrich Apel and contributors. [CC BY-SA 3.0](stroke-data/KANJIVG-LICENSE.txt) permits redistribution and adaptation with attribution and ShareAlike. `stroke-data/*.json` carries the ordered paths from the canonical Japanese SVGs, reformatted as JSON for Stroke Order and Practice Writing. Those adaptations are distributed under CC BY-SA 3.0. The [stroke data notice](stroke-data/README.md) records the source revision and conversion details.

## Review scheduler

[ts-fsrs 5.2.3](https://github.com/open-spaced-repetition/ts-fsrs/tree/v5.2.3) is copyright © 2025 Open Spaced Repetition. The library from earlier releases remains in the repository with its [MIT License](vendor/ts-fsrs.LICENSE). Current GitHub Pages builds exclude the library.

## Artwork and fonts

The War-Camp Parchment illustration (`art/war-camp.webp`) and current `icons/jinchu-*.png` were generated for the project with OpenAI image generation, then resized and exported as WebP and PNG. The [OpenAI terms on output](https://openai.com/policies/terms-of-use/#content) assign OpenAI’s rights in the output, if any, to the user to the extent permitted by law. The images are credited as generated artwork.

The CSS uses fonts already installed on the device. The app ships no font files and requests no remote fonts. The three unused original green icon PNGs were drawn for the first release using the Windows Yu Gothic font. See [Microsoft’s guidance on rendered graphics and font redistribution](https://learn.microsoft.com/en-us/typography/fonts/font-faq). The legacy icons are excluded from the current Pages build.
