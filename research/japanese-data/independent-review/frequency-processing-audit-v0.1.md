# Independent frequency and processing audit v0.1

Research only. Sources: consolidation snapshot 7db35c979ec6f1f1e6a88dcb067690a514c14f14; production curriculum d70055576c40b91fd40f7180f4e7d27f3d9f27a3. All observations below use published research material only, not restricted local corpus records.

## Grade order and character frequency

Independently read the Jiten kanji gzip CSV (14,271 data rows; verified decompressed size and CRC) and joined the production curriculum's seven character groups. All 2,136 matched. Lower rank means more frequent in Jiten's media corpus.

| Grade | n | median rank | top 500 | top 1000 | top 2000 | min | max |
|---|---:|---:|---:|---:|---:|---:|---:|
|1|80|300.5|53|75|80|1|1997|
|2|160|328.5|105|145|159|4|2456|
|3|200|377|117|166|200|25|1824|
|4|202|697.5|70|142|194|39|2977|
|5|193|674|65|144|190|92|2404|
|6|191|932|38|103|182|23|3114|
|Remaining Joyo|1110|1555.5|52|222|835|45|3915|

220/240 (91.67%) of first two grades are in Jiten's top 1000. Retain school-grade progression. Within grade, frequency and educational usefulness may determine order; avoid treating grades as a strict frequency sequence. This is character frequency in one media corpus, not frequency of individual readings or proof of MEXT's intentions.

## Full equal-weight ranking audit

Read all 20 TSV batches (10,000 rows, 10,000 unique JMdict IDs, 9,975 distinct written forms). 23 groups have duplicate written forms; these may be distinct senses/readings (e.g. 人), not necessarily errors. Do not deduplicate by written form alone.

| Prefix | 1 source | 2 sources | 3 sources | 4 sources |
|---|---:|---:|---:|---:|
|100|0|2|4|94|
|500|24|18|23|435|
|1000|56|29|50|865|
|5000|347|158|427|4068|
|10000|751|336|1125|7788|

"Source" here means a non-null admissible rank in the exported winning form. 77.88% of the full list have all four ranks. This does not demonstrate independent corpus agreement or correctness of the selected sense.

Observed entries: 行く #17, 見る #18, 分かる #110, 食べる #114, 来る #258, 一つ #772, 二つ #3242, 小学校 #3487, 十/じゅう #6364. 小学校 has wordfreq rank 2067 and Jiten rank 3202, confirming why adding sources helps.

Missing exact displayed spellings among top 10,000: する, ある, いる, あなた, の, は, が, で, と, こんにちは, ありがとう. Some appear in alternate written forms (有る #133, 或る #1551, 居る #9257, 今日は #1187, 有り難う #400), but that is not a satisfactory learner display. Do not infer missing lexical IDs solely from absence of displayed form. これ #28 and 此れ #176 require identity/sense review rather than an automatic kana-only merge. Four symbol-only entries found: ー #118, ○ #1376, 々 #2132, ◎ #9144. Retain useful symbol knowledge separately from core word cards.

The published unresolved-frequent report confirms actual exclusions: の has no exact form in all four lists; する no exact form in Shiberu (rank 9) and wordfreq (rank 20); いる and ある likewise absent as exact forms; は, が, と, で have ambiguous owners. These are high-priority regression cases. A top-10,000 list is not acceptable until essential vocabulary and grammar coverage are repaired.

## Code-level findings and proposed repairs (not applied)

1. database.py form_rows emits the kana form only if the reading has no permitted kanji spellings. This can omit common kana spellings of kanji-bearing entries. Add a separate display/alias layer with explicit provenance: respect kana restrictions, sense restrictions and uk tags at sense level; verify observed kana forms; do not invent kanji spellings or attach spelling-only rank to a specific reading. Retain original dictionary forms. Common kana spelling can be used for a suitable selected sense without pretending it is a separate JMdict headword. Review examples する, ある, いる, こんにちは, ありがとう.
2. rankings.py rejects all spelling votes if more than one JMdict ID owns the spelling. Preserve that observation as ambiguous lexical evidence rather than distributing it to all owners. Maintain a separate surface-form frequency ledger. For high-frequency cases, use corroborating form-pair evidence, POS where genuinely comparable, and curated sense/entry overrides. Otherwise leave identity unresolved. Provide explicit grammar/function-word coverage independent of lexical scoring. Do not treat every corpus token (punctuation, numerical placeholders, inflection fragments) as an independent study word.
3. Keep equal weights (1,1,1,1) and reciprocal-rank constant 100 as baseline only. Ranking coverage favors it at the 10,000 cutoff; TUBELEX and other profiles may do better at early cutoffs. Retain rank scope, null values, and actual source count. Add a grade-independent essential vocabulary inclusion rule. Avoid promoting obscure variants by descending Unicode spelling as a tie-breaker. Rank lexical identity independently from learner-facing spelling. One ID per list is not a complete deduplication solution; keep distinct useful senses/homographs, review cross-ID variant relationships and avoid accidental duplicates.
4. kanji.py still permits an exact official spelling example to be attached to a reading when no phonologically compatible match exists (the fallback mapping basis is "official example; phonological difference requires review"). Keep this as an unresolved hypothesis outside matched/eligible reading links, never as a candidate carrying that reading. 十/シー must not be linked to とお; 山/ざん must not represent やま. Official examples are form hints, not proof of pronunciation.
5. The current script includes longest-okurigana and possible sound-change refinements, but the published exports precede them. Do not assume they solve the missing readings. Verify target written span, complete reconstructed reading, actual sound and dictionary reading; handle okurigana including inflection and suffixes; distinguish exact from phonological hypothesis. For ambiguous whole-word readings, allow whole-word study, not a false individual reading. Verify 一つ、二つ、五つ、七つ、九つ、大きい、入れる、出る、白い、赤い、青い、丸い、古い、切れる、晴れる、歌う、答える、考える.
6. kanji.py combines all applicable sense flags and requires len(indices)==1 for preferred tier. This can exclude normal multi-sense words and attach an archaic tag from an unrelated sense. Evaluate a selected eligible sense; keep sense-level tags and form-level spelling/reading tags independently. Primary requires natural modern spelling, clear selected cue and validated mapping, not a single dictionary sense. A very common direct reading can be primary even with one word or one strong source. Prefer basic word before a phrase containing it, retain rare official readings for reference, and demote rather than delete appropriate later words.
7. Current handwriting suitability sorts source presence and official-example match before score and grade; change to separate explicit introductory curriculum overrides (after verification), suitability gates, frequency, target familiarity and grade-aware presentation. Do not allow official examples or corpus evidence availability alone to displace everyday words. Preserve good existing cards and historical IDs. No production change or scheduler rewrite is authorized at this stage.

## Handoff
Use grade-1-shortlist-v0.1.json and grade-2-shortlist-v0.1.json as provisional human review inputs, not approved cards. Run the read-only shortlist validation against the preserved local SQLite database to resolve exact IDs and get mapping/sense evidence. No full rebuild needed for that check. Follow with targeted corrections and tests, then extend to higher grades using corrected methodology.

Source files: [rankings](../consolidation/rankings/equal/), [unresolved frequent](../consolidation/unresolved-frequent.json), [database.py](../consolidation/database.py), [rankings.py](../consolidation/rankings.py), [kanji.py](../consolidation/kanji.py), [Jiten kanji](../consolidation/jiten/kanji.csv.gz), [source notices](../consolidation/SOURCES.md). Jiten data CC BY-SA 4.0; preserve the existing source notices.
