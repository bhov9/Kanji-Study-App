# Japanese data acquisition and review

Snapshot collected 25 November 2026 for bhov9/Kanji-Study-App. The supplied strategy describes future proposals. This branch contains research files only.

## Independent review

Start with `review/inventory.json` for parsed entry counts, archive versions and fields. Open `review/comparison.json` for the Shiberu–TUBELEX overlap and representative spellings, or `review/ranks.jsonl` for the full union. Each line is one exact Unicode spelling. Each source value is an array of matching source records. A null means that spelling was absent. Spelling matches can refer to different senses. No spelling normalization, dictionary sense assignment, weighting or reading prioritization was applied.

Shiberu provides its own mixed-corpus rank and per-million rate. TUBELEX describes subtitle exposure. Its rank is one plus the number of lemmas with strictly higher token counts, excluding the totals row. Ties share rank. BCCWJ and CEJC supply their own ranks by lexical record. Homographs retain their source-specific readings and parts of speech. Top-1,000 overlap counts distinct spellings having at least one rank at or above that cutoff (rank ≤ 1,000). A source can contribute fewer or more than 1,000 spellings due to repeated spellings and ties.

The local files `local/comparison.json` and `local/ranks.jsonl` add the NINJAL written short-unit and conversational lemma tables. The conversation archive also contains a word-form workbook and field guide. The TSV and equivalent workbook represent the same lemma list. `local/examples.jsonl` retains each sense link, zero-based sense index, dictionary entry ID, example form, source ID and language-tagged sentence texts. A sentence can illustrate several entries. Per-author credits and translation IDs are unavailable in this release.

## Acquisition and provenance

`package/` contains the original handoff files. Its collector ran successfully for all seven downloads. `package/manifest.json` is the original run log. The subsequent audit and publication decisions are recorded here and in `sources.json`. Each manifest filename resolves under `package/raw/`. The additional NINJAL tables, original EDRDG XML, separate vocabulary-only archive and license notices are included in the audited manifest. TUBELEX was fetched again at its exact commit and produced identical bytes.

Run `python restore.py` with Python 3.11+ to retrieve missing files and check their SHA-256 hashes. Then run `python review.py` to rebuild the review exports. Original upstream XML URLs are rolling and may cease to return these exact snapshots. The restore command reports that change. The pinned JSON conversion and the current upstream XML are audited independently. To collect a newer dictionary release, run the supplied collector in a fresh directory, repeat the audit and update the manifest and notices before publishing newer data.

## Source terms and attribution

- Shiberu Japanese Word Frequency List 2026 by Shiberu, CC BY 4.0. The original compressed list, source credits and license text accompany this snapshot. The comparison selects its published rank and rate. [Dataset and credits](https://shiberu.app/japanese-frequency-list)
- TUBELEX by Adam Nohejl and colleagues (2025). The source repository publishes its own aggregate lists under its repository BSD-3-Clause notice. The notice is included as `package/raw/TUBELEX-LICENSE.txt`. The comparison adds ranks derived from the published counts. [Repository and citation](https://github.com/naist-nlp/tubelex)
- JMdict and KRADFILE are copyright of their respective contributors and distributed under the EDRDG terms. This snapshot includes the unmodified vocabulary-only and component conversions by scriptin. JMdict maps entry IDs to spellings, readings and senses. KRADFILE maps characters to component arrays. The KANJIDIC2 archive stays local because SKIP has separate conditions. EDRDG requires attribution, documentation and regular updates for deployed uses. [EDRDG general license](https://www.edrdg.org/edrdg/licence.html) · [Conversion documentation and notices](https://github.com/scriptin/jmdict-simplified#license) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- JmdictFurigana by Doublevil links a spelling and reading to an ordered sequence of ruby segments with optional kana. The unchanged data file is distributed under the JMdict Attribution-ShareAlike license. MIT applies to the code. [Publisher’s data license](https://github.com/Doublevil/JmdictFurigana#licence)
- The JMdict example-bearing XML and JSON, and their example export, stay local pending sentence-level attribution and translation-rights review. The source IDs are retained. [JMdict project](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) · [Tatoeba downloads](https://tatoeba.org/en/downloads)
- NINJAL permits free research and educational use of the BCCWJ v1.0 and CEJC monitor v202201 tables. Public redistribution of those tables or their per-word ranks was not established. The raw files and four-source review exports are local. [BCCWJ terms](https://clrd.ninjal.ac.jp/bccwj/en/freq-list.html) · [CEJC terms](https://www2.ninjal.ac.jp/conversation/cejc-monitor/cejc-wc.html)

## Findings on 25 November 2026

The current JMdict XML has 219,233 entries, 28 more than the 23 November JSON release (219,205). Both have 32,557 example links. In the JSON release, 28,933 dictionary entries link to 26,485 distinct example source IDs. The two KANJIDIC2 snapshots each contain 13,108 characters, with database revisions 2026-327 (JSON) and 2026-329 (XML). KRADFILE contains 12,156 character mappings. All 236,694 furigana records reconstruct their original written forms when their segments are concatenated. This check does not establish linguistic accuracy for every segmentation.

Shiberu (40,727 lemmas) and TUBELEX (337,756 records) share 27,056 exact spellings. Their top 1,000 ranks share 530 spellings. 太陽 ranks 445 and 1,415, respectively. 太い ranks 4,053 and 1,888. Neither list records 太山 as an exact spelling. Shiberu omits numerals by design, so the missing rank for 十 has a known methodological explanation. BCCWJ supplies 185,136 lexical records and the CEJC monitor supplies 21,020. See the local four-source comparison for all six pairwise overlaps.
