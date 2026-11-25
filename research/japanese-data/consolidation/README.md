# Japanese curriculum research handoff

Start with the [80 Grade 1 records](kanji/grade-1/) and [160 Grade 2 records](kanji/grade-2/). Each filename is one character. The largest file across these two grades is 110,399 bytes. [十](kanji/grade-1/十.json), [生](kanji/grade-1/生.json), [大](kanji/grade-1/大.json) and [太](kanji/grade-2/太.json) link directly to illustrative cases.

| Review material | Contents |
|---|---|
| [Kanji records](kanji/) | Official readings, examples, stages, dictionary readings, current words and provisional candidates for all 2,136 characters. Grade 7 is the remaining Jōyō group. |
| [Experimental rankings](rankings/) and [comparisons](rank-comparison.json) | Nine methods, 10,000 unique JMdict IDs per method, split into 500-row files. [First 500 general candidates](rankings/general/00001-00500.tsv). |
| [Dictionary lookup](lexicon/) | Dictionary and form observations for ranked entries. The filename is the JMdict ID divided by 10,000, rounded down. |
| [Deck audit](deck/) and [named regression cases](regression-cases.json) | Historical word IDs, dictionary matches, spelling-level evidence and cases for linguistic judgment. Flags are review prompts. |
| [Quality summary](quality.json), [frequent unmatched or ambiguous records](unresolved-frequent.json) and [local-validation overlap counts](validation-aggregates.json) | Coverage, mapping limitations, and external validation. |
| [Methods](METHODS.md), [sources and reuse conditions](SOURCES.md), [Jiten manifest](jiten/manifest.json) | Source roles, provisional scoring, permissions, acquisition URLs, sizes and checksums. |

The local SQLite database is at `research/japanese-data/local/curriculum-research.sqlite`. It preserves all 219,205 JMdict records, 325,649 permitted form rows, 236,694 segmentation records and 3,101,557 source observations. GitHub holds the review exports, permitted source snapshots and rebuild scripts. For reproduction after restoring the parent research snapshots, the script order is acquire.py, database.py, rankings.py, kanji.py, handoff.py, verify.py. The current app deck was read from production commit d700555; the research branch itself has an earlier app snapshot.

The public validation summary uses the saved aggregate CEJC, BCCWJ and textbook comparisons. The optional VDRJ and subject-list aggregate extension was interrupted before a completed output was saved. The VDRJ workbook and restricted sources are preserved locally. JEV was investigated and was not acquired. KanjiVG is present in the audited production snapshot as stroke-order data and supplies no ranking votes.

Review missing sources as unknown. Spelling-only observations do not identify a pronunciation or sense. Several methods may legitimately select the same entry. None of the experimental categories or weights has been approved for use in the app.

**Snapshot caveat.** The saved kanji exports precede the last proposed changes to okurigana tie-breaking and rendaku/gemination handling in kanji.py. In these exports, an absent mapping-basis field is unspecified. Do not infer that a phonological hypothesis was validated. A future rebuild with the latest script can produce different candidate ordering and provisional categories. This handoff preserves the existing results for independent review.
