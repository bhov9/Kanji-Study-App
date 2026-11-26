# Japanese curriculum research — master handoff

Updated 26 November 2026. All work below is confined to `research/japanese-data-acquisition`; production branch and app were not modified.

## Starting state and research findings

- The research branch started at `252bed16202f899e1025dd66541269800f46e5a2`, the already-published processing audit. Existing policy, Grade 1–2 shortlists, and consolidation exports were read first; the work here extends rather than replaces them.
- The original `database.py`, `rankings.py`, and `kanji.py` remain unchanged. New, versioned modules are in `tools/` so earlier snapshots remain reproducible.
- The production app was inspected at `main` commit `d70055576c40b91fd40f7180f4e7d27f3d9f27a3`. It has a version-3 kanji progress object under `localStorage` key `kanji-practice.progress`, character-level mastery, review history containing stable `wordId`s, and JSON export/import. The full migration policy is in `progress-migration-policy-v0.1.md`.
- Targeted saved-export inspection confirmed candidate IDs for 十（じゅう）1579840, 生きる 1378520, 太い 1408180, 太陽 1408370, and 食べる 1358280. It also confirmed that 生まれる and 大きい are missing from the capped export candidate maps. This does not establish absence from JMdict. See `priority-case-inspection-v0.1.md`.

## Completed files and commits

| Commit | File |
|---|---|
| `47076acf9fbfbfe137cef745fed0909da195f464` | `tools/verify_shortlists.py` |
| `50954da1b0d40995ab81c34be0f92df38c7a3f9e` | `tools/lexical_policy.py` |
| `86e0f86be501f99f28c0645dcef9b498583020ea` | `tools/reading_mapping.py` |
| `6527608f1a7990557f384f03639f76f9013b642b` | `tools/vocabulary_policy.py` |
| `4dfbc16287c059e143e3af6124efa29f72a38be6` | `tools/generate_higher_grade_shortlists.py` |
| `ce068aa7ac6bd4455671a1f2f311190b5fa918a3` | `tests/test_research_policies.py` |
| `7f6885111af63ba0b37acb3bd7d40a4d56353f11` | `research-tools-v0.2.md` |
| `6b39aadce7bca26049e119fd473e9a911f5a4253` | `progress-migration-policy-v0.1.md` |
| `9f7f1081342bc8d38b7c1be06bffaf7bbde6e5e1` | `sources-copyright-draft-v0.1.md` |
| `d907b96b9ff4f8a730f0961b98f6737347f8daf9` | Fix proposal sorting in `tools/generate_higher_grade_shortlists.py` |
| `72a9cc59535a6d0ed9347d886cc7461f603fb5d3` | `priority-case-inspection-v0.1.md` |
| `e686ac2ad98ea046494b829562315448bb6ea2a9` | `outputs/grade-3-review-queue-v0.1.json` (200 kanji) |
| `fd6de4425c3355d16f1c6cea989f8018af41a64f` | `outputs/grade-4-review-queue-v0.1.json` (202 kanji) |
| `5bdd0571d5042b490ec8f8d9e92bbd715d8958dc` | `outputs/grade-5-review-queue-v0.1.json` (193 kanji) |
| `5fcbbc229b7bd529dc6d401cb5baab6f87a56827` | `outputs/grade-6-review-queue-v0.1.json` (191 kanji) |

This handoff was refreshed after the four queue commits above. Check the research branch history for its current revision and the branch head.

## Decisions

- Preserve JMdict kanji and kana spellings as distinct dictionary forms, with sense-level restrictions. Do not label a dictionary form as an observed corpus spelling or assume one spelling is the preferred learner display without evidence.
- Keep frequency observations attached to the surface and scope they actually measure. A spelling owned by multiple dictionary IDs stays ambiguous until explicitly resolved. Missing observations remain null.
- Keep essential grammar and kana vocabulary as a coverage overlay separate from frequency rank. Exclude punctuation-only items from core lexical candidates.
- Do not infer a per-kanji reading from spelling-only examples or generate rendaku/gemination mappings. Exact segment plus compatible okurigana is required by the new mapping helper; other cases remain unresolved.
- Multiple dictionary senses do not disqualify a common word. Select the intended sense and cue later, with ambiguity visible.
- Keep kanji progress and future vocabulary progress separate. Historical IDs cannot be reassigned; old reviews remain attached to their old identity.
- Existing source notices govern redistribution. Restricted local corpora and per-word derived ranks are not included in this work. See the concise app draft and existing consolidation source notices.

## Tests and limits

- Executed: `python -m unittest discover -s research/japanese-data/independent-review/tests -v` — 12 synthetic regression tests passed.
- Synthetic checks cover exact and ambiguous shortlist matches, read-only SQLite behavior, sense restrictions, kana/kanji form distinction, ambiguity retention, essential coverage, reciprocal-rank nulls, punctuation, okurigana, 十/シー, 山/ざん, stable IDs, and higher-grade queue labeling.
- Not executed: exact Grade 1–2 validation against the full SQLite database. That file is local-only and was not available in this workspace. The verifier is prepared for that run.
- Generated: complete automated Grade 3–6 review queues from the saved public per-kanji exports (786 total). The source-count check matched 200/202/193/191. Proposals preserve legacy mappings but still require exact SQLite verification and human review.
- Not generated: Grade 7 / remaining 1,110 Jōyō kanji. The current generator targets elementary grades.
- Not completed: corrected full database/ranking rebuild, full 10,000-entry coverage re-evaluation, individual review of 240 Grade 1–2 candidates, or publication/license clearance of a final app data bundle.

## Next tasks

1. On Codex's checkout, run the tests and the read-only Grade 1–2 verifier against the existing SQLite database. Review all missing and ambiguous records, especially 十, 生まれる, 大きい, 食べる, kana forms, and particles.
2. Run exact verification for the generated Grade 3–6 queues. Save these as automated proposals, then human-review high-importance and ambiguous cases.
3. Integrate the new form, evidence, and mapping policies into a versioned rebuild script; preserve old outputs and source-specific rank observations. Compare rankings and essential coverage at several cutoffs before releasing another experimental list.
4. Complete deterministic tests against real JMdict/JmdictFurigana records and re-check redistribution notices for every proposed app asset. Keep production data, scheduler, and deployments unchanged until separately authorized.

## Codex continuation prompt

> Continue only on `research/japanese-data-acquisition`. Run `research/japanese-data/independent-review/tests/test_research_policies.py`, then use `tools/verify_shortlists.py` in read-only mode against `research/japanese-data/local/curriculum-research.sqlite` for the Grade 1 and Grade 2 provisional JSON files. Resolve exact IDs, senses, spelling restrictions, cues, segmentations, and frequency scopes; keep ambiguous and missing rows unresolved. Generate and validate Grade 3–6 proposal queues using `tools/generate_higher_grade_shortlists.py`. Integrate the new policies as a versioned research rebuild, preserving the original scripts and outputs, per-source ranks, nulls, historical IDs, and license notices. Do not change production files, user progress, scheduling, or deployment. Update this handoff with executed commands, results, commit SHAs, remaining blockers, and only data whose redistribution terms are established.
