# Kanji-Study-App
Japanese kanji writing practice

A static writing practice app with 26 starter words. Write the word from its hiragana and English cue, reveal the spelling, then grade each new or due kanji. A kanji shares one review schedule across all words. The history also records the word shown at each review.

## Project files

| Files | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Study screen, progress, and backup controls |
| `data.js` | Vocabulary and reusable kanji breakdowns |
| `study.js` | Scheduling and versioned progress format |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation and offline caching |

No packages or build steps are required. Run `python -m http.server 8000` from this directory and open `http://localhost:8000/`.

## Review rules

- Select an outcome for each review target. You can change it up to the moment you press **Next Word**, which saves the final grades together.
- Due kanji come first. The app randomizes among words covering the oldest batch of due characters and avoids repeating the previous word when an alternative is eligible.
- New kanji enter in grade order as the due queue clears. The default is five per local calendar day. Change the limit under **Progress**. Set it to zero for reviews only.
- [ts-fsrs 5.2.3](https://www.npmjs.com/package/ts-fsrs/v/5.2.3) supplies FSRS-6 with a target retention of 90%. Correct maps to Good, and Incorrect maps to Again. Learning and relearning use 10- and 30-minute steps.
- Memorized suspends the kanji across the deck. Use Progress to reactivate it for immediate review.
- Progress stays in this browser's local storage. Export a backup before transferring devices or clearing browser data. Import replaces local progress after confirmation. Keep word IDs stable when editing the deck so earlier review events retain their vocabulary context.

The app reads both original and current backups. It reconstructs FSRS memory state from earlier grades and preserves existing due dates and Memorized statuses. The first successful save writes the updated format under the same browser storage key.

Run the grading, scheduling, and migration tests with `node --test tests/study.test.mjs` from this directory.

## Publish to GitHub Pages

1. Commit the contents of this directory to the root of the repository.
2. In repository **Settings → Pages**, select **Deploy from a branch**, choose the branch you committed to (usually `main`), select **/(root)**, and save.
3. When Pages shows the site as live, open it in iPhone Safari. Use **Share → Add to Home Screen** and enable **Open as Web App** if shown.
4. Open the Home Screen app while online and wait for **Ready for offline study**. Grade a kanji, close the app, turn on airplane mode, then reopen it to confirm the deck loads and the grade persists.

Increment the cache revision in `sw.js` whenever you change a cached file. Close all open app windows after an update downloads so the new service worker can take over on the next launch.

## Content references

- [MEXT elementary curriculum and grade assignments](https://www.mext.go.jp/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/09/26/1413522_001.pdf)
- [EDRDG JMdict dictionary project](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html)
- [KanjiVG structure reference](https://kanjivg.tagaini.net/)

The breakdowns describe visible writing forms. Memory aids are original stories created for recall.
