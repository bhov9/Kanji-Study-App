# Independent research tools v0.2

These versioned modules add conservative processing policies alongside the existing consolidation snapshot. They do not change the app, historical rankings, local SQLite file, production data, or scheduling. The old exports remain useful evidence but their reading mappings predate the audit and are not treated as verified.

## Files

- `tools/verify_shortlists.py` checks exact spelling/reading forms against the preserved database. It opens SQLite with `mode=ro` and `query_only=ON`; output includes exact IDs, allowed sense indexes and glosses, form restrictions, segmentation, and separate spelling-only versus form-pair frequency evidence. Ambiguous owners remain ambiguous. No match is not automatically treated as rare.
- `tools/lexical_policy.py` emits distinct JMdict kanji and kana forms, filtering each applicable sense at the correct scope. It keeps observed corpus spelling evidence in a surface ledger until a unique or explicitly reviewed identity exists. A curated resolution must name an existing owner and a rationale. It also rejects isolated punctuation/symbol records and checks that historical IDs still describe the same spelling and reading.
- `tools/reading_mapping.py` only returns a kanji reading when the segmented kana exactly matches an attested dictionary reading and compatible okurigana. Rendaku, gemination, jukujikun, ateji, inflectional inference, and other sound changes are unresolved unless separately reviewed; no reading is fabricated.
- `tools/vocabulary_policy.py` supplies an independent essential-coverage overlay for omitted kana words, basic verbs, pronouns, and grammar items. The overlay flags coverage gaps but does not change the experimental RRF score. RRF uses per-source ranks, retains nulls and observed-source counts, and never averages raw counts.
- `tools/generate_higher_grade_shortlists.py` turns the existing Grade 3–6 per-kanji exports into a review queue while retaining JMdict IDs, senses, cues, and source ranks. Since the saved candidate mappings are legacy exports, every proposal remains explicitly unverified.
- `tests/test_research_policies.py` contains small synthetic regression fixtures.

## Run

From the repository root, with the existing local research SQLite database restored:

```sh
python -m unittest discover -s research/japanese-data/independent-review/tests -v
python research/japanese-data/independent-review/tools/verify_shortlists.py \
  research/japanese-data/local/curriculum-research.sqlite \
  research/japanese-data/independent-review/grade-1-shortlist-v0.1.json \
  research/japanese-data/independent-review/grade-2-shortlist-v0.1.json \
  -o research/japanese-data/independent-review/outputs/shortlist-verification-v0.1.json
python research/japanese-data/independent-review/tools/generate_higher_grade_shortlists.py \
  research/japanese-data/consolidation/kanji \
  research/japanese-data/independent-review/outputs/grades-3-to-6-review-queue-v0.1.json
```

The verification run was not performed here because the full SQLite database is local-only and was not attached to this workspace. The test suite uses synthetic SQLite fixtures and does not establish validation against the full JMdict snapshot. Do not publish a generated queue as an approved curriculum. Keep local restricted corpus values out of public output.

## Confirmed tests in this workspace

`python -m unittest discover -s research/japanese-data/independent-review/tests -v` — 12 tests passed. Covered kana-plus-kanji representation, sense-specific restrictions, ambiguous evidence retention, curated resolution validation, essential coverage, RRF null preservation, punctuation exclusion, exact and unresolved reading mappings (including 十/シー and 山/ざん safeguards), higher-grade legacy mapping labels, historical-ID stability, and read-only exact shortlist verification behavior.

## Current limitations

- The modules are a corrected, reviewable research layer; the original `consolidation/database.py`, `rankings.py`, and `kanji.py` are preserved unchanged for reproducibility. A future full rebuild should deliberately integrate and validate these policies rather than silently replacing the snapshot.
- Exact Grade 1–2 ID/sense/mapping validation still needs a run against the local SQLite database. Ambiguous and missing records need adjudication.
- The higher-grade generator needs the existing exported per-character JSON files. Its queue should be generated and then checked with `verify_shortlists.py`; neither source ranking nor saved mappings are approvals.
- General 10,000-word ranking remains experimental. Essential coverage, lexical de-duplication, homograph handling, source overlap and entertainment bias still need quantitative analysis with full research data.
