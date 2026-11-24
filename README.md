# Kanji-Study-App
Japanese kanji writing practice

A static writing practice app with 26 starter words and a browser for all 2,136 Jōyō kanji. In study mode, write the word from its hiragana and English cue, reveal the spelling, then grade each new or due kanji. A kanji shares one review schedule across all words. The history also records the word shown at each review.

## Project files

| Files | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Study screen, progress, and backup controls |
| `data.js` | Vocabulary and reusable kanji breakdowns |
| `curriculum.js` | The official Jōyō repertoire and seven grade groups |
| `kanji-reference.js`, `browser.js` | Reference readings and meanings, grade browser, and detail panels |
| `examples.js` | Optional example sentences keyed by stable vocabulary IDs |
| `study.js` | Scheduling and versioned progress format |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation and offline caching |

GitHub Pages builds the static site with Jekyll. For a local preview that renders the build timestamp and service worker, use [GitHub Pages’ local Jekyll setup](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/testing-your-github-pages-site-locally-with-jekyll).

## Review rules

- Select an outcome for each review target. You can change it up to the moment you press **Next Word**, which saves the final grades together.
- Due kanji come first. The app randomizes among words covering the oldest batch of due characters and avoids repeating the previous word when an alternative is eligible.
- A grade opens once each character in the previous grades has been introduced or marked Memorized. Previously introduced cards remain eligible for review at every grade.
- In **Browse Kanji → Edit Progress**, you can change individual or whole-grade Memorized statuses. **Confirm Changes** saves the pending changes together and keeps existing streaks and review history.
- New kanji enter in grade order while cards await review, with no daily introduction or review cap.
- Consecutive Correct grades schedule reviews after 1, 3, 7, 14, and 28 elapsed days. Six Correct grades make a kanji ready for manual memorization. Further Correct grades keep that status and schedule another review in 28 days.
- Incorrect resets the streak and queues the kanji until 10 distinct other kanji have been graded. Only then does it receive a due date. Kanji in the same submission as the miss and optional practice do not count.
- **Guided Writing** opens per tested kanji after revealing the answer. Tracing does not change grades or review dates.
- Memorized suspends the kanji across the deck. Use Progress to reactivate it for immediate review.
- Progress and feedback stay in separate local storage records. A backup includes both. Restoring an older backup replaces progress and retains current feedback. Keep word IDs stable when editing the deck so earlier review events retain their vocabulary context.

The app reads earlier and current backups. It reconstructs streaks and recalculates active due dates from recorded grades. It preserves the original review history and Memorized statuses. The first successful save writes the updated format under the same browser storage key.

Browse Kanji includes the entire curriculum. Study selects from the vocabulary in `data.js`. Memorizing a kanji from the browser updates its status without adding a vocabulary review. Reactivating a previously studied kanji restores its schedule. A browser-only kanji returns to Not Started when reactivated.

Run the curriculum, grading, scheduling, and migration tests with `node --test tests/*.test.mjs` from this directory.

## Publish to GitHub Pages

1. Commit the contents of this directory to the root of the repository.
2. In repository **Settings → Pages**, select **Deploy from a branch**, choose the branch you committed to (usually `main`), select **/(root)**, and save.
3. When Pages shows the site as live, open it in iPhone Safari. Use **Share → Add to Home Screen** and enable **Open as Web App** if shown.
4. Open the Home Screen app while online and wait for **Ready for offline study**. Grade a kanji, close the app, turn on airplane mode, then reopen it to confirm the deck loads and the grade persists.

Each Pages build stamps **Last app update** in Japan time and uses the same build time in its offline cache revision. Close all open app windows after an update downloads so the new service worker can take over on the next launch.

## Content references

See [Sources and license notices](THIRD-PARTY-NOTICES.md) for the bundled assets, how the source material was adapted, and the applicable redistribution terms. The app includes offline credits under **Sources & Licenses**.

- [MEXT elementary curriculum and grade assignments](https://www.mext.go.jp/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/09/26/1413522_001.pdf)
- [National Institute for Educational Policy Research HTML transcription of the official grade table](https://erid.nier.go.jp/files/COFS/h29e/chap2-1.htm)
- [Agency for Cultural Affairs official Jōyō list](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/index.html) and [JIS-to-Unicode cross-reference](https://x0213.org/joyo-kanji-code/index.html)
- [EDRDG JMdict dictionary project](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html)
- [KanjiVG structure reference](https://kanjivg.tagaini.net/)

The 2,136 extracted character entries from the Agency for Cultural Affairs PDF match the Unicode cross-reference. The first six groups follow the official MEXT appendix. It lists both 埼 and 崎 in Grade 4, a distinction corrected from the NIER HTML transcription.

The breakdowns describe visible writing forms. Memory aids are original stories created for recall.

`kanji-reference.js` adapts the Japanese on and kun readings and English glosses from [KANJIDIC2](https://www.edrdg.org/kanjidic/kanjd2index_legacy.html), copyright James William Breen and the Electronic Dictionary Research and Development Group. The adapted dictionary data is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) under the [EDRDG dictionary license](https://www.edrdg.org/edrdg/licence.html). Refresh it from the latest source with `python scripts/update_kanji_reference.py` during content updates.

Add future vocabulary and structural notes to `data.js`. Keep word IDs stable and use the curriculum characters as keys so progress and existing review history continue to match.

The supplemental deck in `grade-vocabulary.js` gives every curriculum character a vocabulary prompt. It uses Japanese spellings, readings, and English glosses from [JMdict](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html), copyright EDRDG and James William Breen, under [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html). The import selects common, grade-appropriate spellings where possible. To reproduce it, download `JMdict_b.gz` from [EDRDG](https://www.edrdg.org/pub/Nihongo/) and run `python scripts/import_grade_vocabulary.py PATH_TO_JMdict_b.gz`.

## Adding example sentences

See [linguistic review exports](linguistic-review/README.md) for the current deck, reading mappings, and selection logic.

Study prompts underline the kana belonging to the tested kanji. When adding vocabulary, the optional fifth field holds reading parts in written character order, including any kana. Use an ordinal hint by omitting the mapping when boundaries are ambiguous.

After revealing the answer, each tested kanji has a Stroke Order panel. The PWA caches the complete curriculum’s KanjiVG path data in 32 small bundles (about 1.9 MB total before compression). A panel reads only the bundle for its character. See the [source and license notice](stroke-data/README.md) or regenerate the bundles with `python scripts/import_kanjivg.py PATH_TO_KANJIVG_CHECKOUT`.

Add records under the vocabulary ID in `examples.js`. Each sentence uses a list of plain Japanese strings, furigana segments such as `{ ruby: '明治', reading: 'めいじ' }`, and exactly one `{ target: true }` slot. The app takes the kana and kanji for the slot from the vocabulary entry. Keep all target characters out of the other segments. Use furigana for difficult or above-grade kanji.

Optional `translation` starts collapsed. A `historicalNote` and its `sources` become available after reveal. Keep drafts out of study until their Japanese has been reviewed and historical claims have been checked against sources. The app displays the first entry marked `reviewed` or `source-checked`, with no empty example frame for words without one.
