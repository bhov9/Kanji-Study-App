# Sources and license notices

## Curriculum

- [常用漢字表 (2010 Cabinet Notification No. 2)](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/), published by Japan’s Agency for Cultural Affairs, supplies the 2,136 characters. The app extracts the characters and regroups them in `curriculum.js`. The notice also includes official standard readings. The readings in Kanji Details come from KANJIDIC2.
- [Elementary School Course of Study (2017), grade allocation appendix](https://www.mext.go.jp/content/20230120-mxt_kyoiku02-100002604_01.pdf), published by Japan’s Ministry of Education, Culture, Sports, Science and Technology (MEXT), supplies the character assignments for Grades 1–6. The app reformats the groupings and places the remaining Jōyō characters in a seventh group.
- [The promulgation of the Gakusei](https://www.mext.go.jp/b_menu/hakusho/html/others/detail/mext_03459.html), published by MEXT, is the reference for the short, paraphrased historical note in `examples.js`.

The [Agency’s website policy](https://www.bunka.go.jp/bunkacho_homepage/) refers users to the [MEXT website reuse terms](https://www.mext.go.jp/b_menu/1351168.htm) for its content. Those terms permit redistribution and adaptation of covered materials, including commercial reuse, and ask for source credit and identification of edits. The app uses the government lists and a historical fact from these sources. Its extracted groupings and paraphrase are app edits.

The [NIER HTML grade table](https://erid.nier.go.jp/files/COFS/h29e/chap2-1.htm) and [Project X0213 code table](https://x0213.org/joyo-kanji-code/index.html) were used for cross-checking. The app distributes the character and grade data from the official government tables. It ships neither comparison file nor Project X0213’s encoding mappings.

## Dictionary data

Copyright © James William Breen and the Electronic Dictionary Research and Development Group (EDRDG). EDRDG’s [dictionary license and attribution terms](https://www.edrdg.org/edrdg/licence.html) permit copying, redistribution, and adaptation under [Creative Commons Attribution-ShareAlike 4.0 International](licenses/CC-BY-SA-4.0.txt). The bundled adaptations below are distributed under the same license.

- [JMdict project documentation](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) and [upstream files](https://www.edrdg.org/pub/Nihongo/). `grade-vocabulary.js` selects spellings, readings, and English glosses from `JMdict_b.gz`, formats them as study prompts, and adds kana-to-character alignment where available. The file header records the archive’s SHA-256, and `scripts/import_grade_vocabulary.py` documents the selection and conversion.
- [KANJIDIC project documentation](https://www.edrdg.org/wiki/KANJIDIC_Project.html) and [KANJIDIC2 file documentation](https://www.edrdg.org/kanjidic/kanjd2index_legacy.html). `kanji-reference.js` filters the XML to the Jōyō characters and reformats the Japanese on and kun readings and English glosses as JavaScript. The file header records the snapshot date, and `scripts/update_kanji_reference.py` records the upstream download and conversion.

## Stroke-order data

[KanjiVG](https://github.com/KanjiVG/kanjivg#licence) is copyright © Ulrich Apel and contributors. [CC BY-SA 3.0](stroke-data/KANJIVG-LICENSE.txt) permits redistribution and adaptation with attribution and ShareAlike. `stroke-data/*.json` carries the ordered paths from the canonical Japanese SVGs, reformatted as JSON for Stroke Order and Practice Writing. Those adaptations are distributed under CC BY-SA 3.0. The [stroke data notice](stroke-data/README.md) records the source revision and conversion details.

## Review scheduler

[ts-fsrs 5.2.3](https://github.com/open-spaced-repetition/ts-fsrs/tree/v5.2.3) is copyright © 2025 Open Spaced Repetition. The [MIT License](vendor/ts-fsrs.LICENSE) permits redistribution and modification with preservation of its copyright and permission notices. The app bundles the browser module in `vendor/ts-fsrs.js` and distributes the full notice with it.

## Artwork and fonts

The War-Camp Parchment illustration (`art/war-camp.webp`) and current `icons/jinchu-*.png` were generated for the project with OpenAI image generation, then resized and exported as WebP and PNG. The [OpenAI terms on output](https://openai.com/policies/terms-of-use/#content) assign OpenAI’s rights in the output, if any, to the user to the extent permitted by law. The images are credited as generated artwork.

The CSS uses fonts already installed on the device. The app ships no font files and requests no remote fonts. The three unused original green icon PNGs were drawn for the first release using the Windows Yu Gothic font. See [Microsoft’s guidance on rendered graphics and font redistribution](https://learn.microsoft.com/en-us/typography/fonts/font-faq). The legacy icons are excluded from the current Pages build.
