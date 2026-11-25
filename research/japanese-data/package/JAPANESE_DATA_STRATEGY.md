# Japanese language data strategy

**Project:** Kanji Study App — `bhov9/Kanji-Study-App`  
**Status:** Research and implementation specification, 25 November 2026. Proposed methodology; not a completed or validated vocabulary dataset.

## 1. Scope

Prioritize all 2,136 Jōyō kanji and an initial curriculum of 10,000 common Japanese vocabulary entries. Keep the existing grade-based kanji study, handwriting, feedback, review scheduling and saved progress. Move Start Studying and Browse Kanji into a Kanji submenu; provide a Vocabulary section and a Grammar placeholder. Grammar, pitch accent and audio are future work only. Use shared vocabulary IDs so the same word can appear in both Kanji and Vocabulary without duplicating content or merging their independent study progress.

## 2. Source register

| Resource | Role | License / release gate | Source |
|---|---|---|---|
| TUBELEX | Primary candidate for general/spoken exposure frequency; Japanese lemma/POS lists | Repository BSD-3-Clause; verify exact downloaded aggregate data terms and preserve notices; do not import raw subtitles | https://github.com/naist-nlp/tubelex |
| Shiberu | Secondary candidate for dictionary-form written/mixed frequency | CC BY 4.0 per publisher; record version and attribution | https://shiberu.app/japanese-frequency-list |
| BCCWJ | Independent written-frequency and school textbook validation | Check specific frequency-table redistribution terms before bundling; research-only until cleared | https://clrd.ninjal.ac.jp/bccwj/en/freq-list.html |
| CEJC | Independent everyday conversation validation | Check specific table redistribution terms before bundling; research-only until cleared | https://www2.ninjal.ac.jp/conversation/cejc-monitor/cejc-wc.html |
| JMdict | Vocabulary spelling, reading, English glosses, POS, sense restrictions, usage labels, domains and commonness flags | EDRDG general dictionary license / CC BY-SA 4.0; verify applicable exclusions and update conditions | https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html |
| KANJIDIC2 | Kanji meanings, Japanese readings, okurigana notation, stroke count, grades and radical metadata | EDRDG license; exclude separately restricted fields unless authorized | https://www.edrdg.org/wiki/KANJIDIC_Project.html |
| JMdict Simplified | Convenient JSON conversion of dictionary datasets; use pinned releases, not arbitrary mirrors | Conversion does not replace upstream data licenses | https://github.com/scriptin/jmdict-simplified/releases |
| JmdictFurigana | Candidate word-specific reading segmentation | Verify data license separately from MIT code; preserve upstream attribution | https://github.com/Doublevil/JmdictFurigana |
| JMdict with Examples | Candidate sense-linked example sentences | Verify dictionary and individual sentence/translation terms | https://github.com/scriptin/jmdict-simplified/releases |
| Tanaka Corpus / Tatoeba | Supplemental Japanese-English sentence pairs | Original Tanaka corpus public domain; later additions may have separate licenses; preserve author and sentence IDs and applicable notices | https://www.edrdg.org/wiki/Tanaka_Corpus.html ; https://tatoeba.org/en/downloads |
| KRADFILE | Visual components (distinguish from dictionary indexing radical) | EDRDG license, verify specific file | https://ftp.edrdg.org/krad/kradinf.html |
| KanjiVG | Existing stroke-order data | CC BY-SA 3.0, retain attribution | https://github.com/KanjiVG/kanjivg |
| Official Jōyō table / MEXT | Standard readings and grade assignments, educational validation | Verify exact official source and reuse terms; retain existing curriculum | https://www.bunka.go.jp/ ; https://www.mext.go.jp/ |

EDRDG authoritative license: https://www.edrdg.org/edrdg/licence.html . TUBELEX Japanese data variants and documentation: https://github.com/naist-nlp/tubelex/blob/main/README.md . The sources above are candidates, not blanket legal clearance. Free access does not imply redistribution rights. Public GitHub repositories and Pages distribute data even without payment. Do not publish restricted data, including derived rankings where terms prohibit them. If terms are unclear, omit from public build and report the issue; do not assume a noncommercial exception. Preserve ShareAlike obligations for applicable adaptations, source notices and update requirements. Keep licenses for code and data distinct.

## 3. Frequency pipeline

1. Inspect the current repository, import scripts, data schemas, notice files and study selection logic first. Reuse sound existing data.
2. Download pinned releases of the permitted sources. Record file URL, version/date, SHA-256, license URL, attribution, transformation and row counts in a manifest. Prefer TUBELEX Japanese lemma/POS variant; verify column definitions and unit of counting. Shiberu is a mixed-source list, not a pure written corpus. Treat subtitle frequency as a proxy, not literal spontaneous conversation frequency.
3. Join frequency records to JMdict using normalized spelling, reading and POS where available. Preserve original spelling and kana; normalize Unicode and kana for matching only. Keep spelling/reading restrictions and sense identifiers. Do not assign an ambiguous spelling's entire frequency to every homograph. Flag ambiguous matches and report coverage. Avoid double-counting orthographic variants or inflections; do not merge genuinely distinct lexical entries merely because they sound alike.
4. Keep each source's raw counts/ranks separately; do not average raw counts from corpora of different sizes. Evaluate normalized percentile/rank fusion (e.g. reciprocal rank fusion) against a single-source baseline. A provisional equal-weight fusion is an experiment, not an approved final ranking. Missing entries are unknown, not necessarily rare; define and report missing-data handling. Preserve separate spoken-proxy and mixed/written ranks with honest labels.
5. Exclude noise, fragments, proper names and purely grammatical tokens from the core vocabulary curriculum when appropriate; keep useful particles and expressions separately if needed. Document inclusion rules. Produce 10,000 distinct study entries, with stable IDs and frequency bands (1–1,000; 1,001–3,000; 3,001–5,000; 5,001–10,000). These bands are not JLPT levels. Retain additional eligible dictionary words for kanji lookup where useful.
6. Before deployment, export comparative ranks, match ambiguity, missing entries, top 100/1000 samples and representative words for human review. Do not claim a validated top 10,000 until reviewed. Do not invent ranks for uncovered words.

## 4. Kanji readings and representative words

Keep comprehensive dictionary readings separate from recommended study readings. List on'yomi and kun'yomi separately, with common readings first, uncommon/obsolete/name-only readings clearly labeled. Preserve okurigana boundaries: 生きる = い + muted きる; 太い = ふと + muted い. Verify standard reading status against official materials; dictionary order is not frequency order.

Build a kanji-to-word index from JMdict and verified word-specific segmentation. Rank common compounds using the shared vocabulary ranking; include common single-kanji words and inflected dictionary headwords too. Estimate reading significance from frequencies of reliably mapped words, without counting ambiguous readings multiple times. Report the number of supporting words and source ranks; lexical frequency is only a proxy for reading significance. Keep manually reviewed pedagogical overrides separate, with rationale and source. Distinguish primary study, secondary study and reference-only readings; never silently promote rare readings just because they exist in a dictionary.

For introductory kanji writing questions prefer familiar, educationally representative vocabulary, clear English cues and unambiguous target spelling. Prefer grade-appropriate examples, but do not sacrifice ordinary usage to avoid higher-grade characters (show non-target characters as necessary). Use verified segmentation for separate underlines; e.g. 小学校 = しょう / がっ / こう; 地図 = ち / ず. Do not force jukujikun or other inseparable readings into fabricated per-character boundaries.

Regression examples (pedagogical examples, not verified corpus rank order): 太 → 太い（ふとい）, 太陽（たいよう） rather than obscure 太山（たいざん）; 十 → 十（じゅう） rather than isolated と; 大 → 大きい / 大学; 小 → 小さい / 小学校; 生 → 生きる / 生まれる / 生活 / 学生. Also audit 上、下、行、日, multiple readings of a single spelling, and ambiguous prompts. Test all 80 grade-1 kanji before expanding to subsequent grades; export all 2,136 for review.

## 5. Vocabulary and example sentences

Store spelling variants, kana readings, English sense glosses, POS, usage/domain/register labels where sourced, frequency ranks, kanji links and verified furigana segmentation. Preserve JMdict sense restrictions; distinguish commonness tags from measured frequency. Add synonyms, antonyms, transitive/intransitive relationships and collocations only with reliable evidence; do not invent them. For each word prefer one or more natural, concise, sense-appropriate examples with English translations. Preserve sentence IDs, author/translation attribution and license. Filter mismatches, unnatural sentences and overly difficult examples. Flag missing examples instead of pretending complete coverage. AI-created examples, if later authorized, must be separately labeled and reviewed.

## 6. Repository architecture (suggested paths; adapt to existing code)

- `docs/JAPANESE_DATA_STRATEGY.md` — this specification.
- `docs/DATA_REVIEW.md` — audit findings, decisions and unresolved questions.
- `data/sources/manifest.json` — versioned source provenance, checksums and licenses.
- `data/overrides/kanji-study.json` — reviewed reading/word overrides; stable IDs, reasons and references.
- `scripts/` — reproducible acquisition, normalization, ranking, segmentation and validation tools.
- `data/generated/` — permitted compact runtime datasets, split into manageable chunks; use existing app conventions where better.
- `data/review/` — permitted JSON/CSV exports of current and proposed kanji/vocabulary data, including each frequency source and selection reason.
- Existing `THIRD-PARTY-NOTICES.md` and in-app sources page — update both.

Keep raw downloads out of Git when too large or not redistributable; keep reproducible download instructions and checksums. Never commit credentials, private user feedback/progress, or restricted corpora. GitHub public files are accessible to everyone. Keep large artifacts out of the published Pages build if not required. Use versioned offline assets; avoid eagerly caching unnecessary data; test iPhone PWA storage and update migrations. Stable kanji IDs and word IDs must preserve existing progress; keep kanji and vocabulary study history independent. Future grammar and pronunciation tables can link by stable IDs but need no implementation now.

## 7. Acceptance and handoff

Before changing the live curriculum, produce a comparative ranking report, source/license manifest, mapping coverage statistics, representative-word audit, and all-kanji review export. Include current selected words, proposed alternatives, readings and reasons. Ask for review of unresolved linguistic or licensing issues; do not silently guess. Implement approved data with automated regression tests, offline tests and saved-progress migration tests. Do not change review intervals, handwriting or feedback behavior as part of this data task.

Commit and push this specification, reproducible scripts, approved datasets/overrides and audit reports to GitHub. Use a branch or pull request for data changes before merging into the live Pages branch. Confirm remote commit hash and file paths. A local commit alone is not a remote backup. GitHub protects committed project files from local computer loss, not personal browser study history; retain separate progress backups.
