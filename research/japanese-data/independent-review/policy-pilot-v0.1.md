# Independent educational review — policy v0.1 and pilot
Research only. Reviewed snapshot: 7db35c979ec6f1f1e6a88dcb067690a514c14f14. No production changes. These are provisional educational judgments, not corpus-derived reading frequency estimates or approved curriculum entries.

## Separate three decisions
1. General vocabulary: lexical usefulness, independent of kanji grade. Start with equal-weight reciprocal-rank experiment as baseline; it has the strongest coverage at 10,000 among the nine tested methods on the saved validation aggregates. Compare early cutoffs separately. Do not count BCCWJ short/long as independent evidence. Keep all source observations and scope.
2. Reading importance: common, standard readings and useful recurring words, not the number of dictionary entries alone. An everyday kun reading may have only one principal word; that is sufficient. Official status and educational stage are evidence, not frequency. Keep all dictionary readings in reference, with name readings separate.
3. Handwriting: pick a natural modern written form with a clear English cue and reliable target mapping. Prefer familiar surrounding kanji but allow partial targeting of a higher-grade compound when it is substantially more useful. Never select a rare spelling merely because it has simpler kanji. No change to character-based progress or historical IDs.

## Selection policy
- First check spelling, reading, applicable sense and usage flags at their correct scope. A flag attached to another sense is not grounds to discard a common sense. Multiple senses are not a disqualifier: select a clear sense and add a short context if required.
- Standard kana-preferred vocabulary may belong in the vocabulary curriculum but not as an artificial kanji-writing exercise. Keep particles and useful grammatical forms in a separately identifiable class; exclude standalone punctuation/symbol noise from core vocabulary. Do not deduplicate by kana alone; review equivalent variant forms across JMdict entries and retain distinct homographs/senses as appropriate.
- Spelling-level ranks are not pronunciation-level evidence. Unambiguous Jiten form-pair evidence may disambiguate, subject to source limitations. A null is not a zero or proof of rarity. Do not copy shared evidence into independent votes. A single very frequent standard form is sufficient to propose a primary word even when other sources have missing or ambiguous observations.
- Prefer representative common direct words (e.g. 食べる, 一つ) over a phrase containing them. Official examples are suggestions, not a hard sort key. Keep a small curated coverage floor for basic numerals, directions, time, body, and other everyday concepts even if tokenization hides them.
- For reading mapping, retain surface kana, full dictionary reading, stem, okurigana and normalized sound-change relationship separately. Match the longest appropriate okurigana and support inflected/nominal forms without assigning unrelated readings. Keep multi-character ruby spans intact. No guessed segmentation for jukujikun or ambiguous forms. Where valid, test the whole word rather than a false per-kanji mapping.
- Treat official variant notes (e.g. 十 ジッ/ジュッ) as evidence, not unrelated nonstandard readings. Distinguish contextual phonetic variants (日 ひ→び) and alternate pronunciations from independent dictionary readings.
- Preferred = useful initial study reading/form, secondary = useful later study, reference-only = legitimate but generally not a normal study target. Keep a distinct introductory word order per character; a primary reading may have several words. No required equal number of readings per character. Treat rare official readings as reference or secondary rather than deleting. Provisional priorities are not claims of precise rank.

## Pilot: 16 characters, selected to expose failure modes
The following is a human-readable shortlist for later exact-form ID verification. The order within each cell is illustrative; not all readings listed. Words beyond the exported shortlist are reviewer proposals requiring dictionary identity/segmentation verification before implementation. English cues illustrate a selected sense, not a complete definition.

| Grade | Kanji | Initial handwriting | Further useful examples | Review concern |
|---|---|---|---|---|
|1|一|一（いち, one）, 一つ（ひとつ, one thing）|一度（いちど）, 一緒（いっしょ）, 一言（ひとこと）|ひとつ absent from reading candidate list although in current deck; イツ sound changes should be handled separately.|
|1|十|十（じゅう, ten）|十日（とおか）, 十回（じゅっかい/じっかい）, 十人十色（じゅうにんといろ）|Reject シー→とお false link; standalone と not introductory; preserve distinct ID for corrected card.|
|1|日|日（ひ, day/sun）|毎日（まいにち）, 休日（きゅうじつ）, 三日（みっか）, 月曜日（げつようび）|Treat び as contextual variant; verify date mappings, Japanese whole-word readings separately.|
|1|月|月（つき, moon）|九月（くがつ）, 月曜（げつよう）, 先月（せんげつ）|Do not prefer 月見 to basic 月 solely due to more available scores; use actual month context.|
|1|人|人（ひと, person）|人口（じんこう）, 人間（にんげん）, 人生（じんせい）|Common single character and compounds are preferable to obscure alternatives; retain existing good cards.|
|1|大|大きい（おおきい, big）|大学（だいがく）, 大変（たいへん）, 大きな（おおきな）|おおきい and おおいに have empty reading candidate lists; 大きな not an exact substitute.|
|1|生|生きる（いきる, to live）|生活（せいかつ）, 一生（いっしょう）, 生まれる（うまれる）, 生卵（なまたまご）, 生む（うむ）, 生える（はえる）|Standard 生まれる lost while 生れる survives; 生む empty; なま useful even if capped frequent count small.|
|1|上|上（うえ, above/top）|上げる（あげる）, 上がる（あがる）, 上着（うわぎ）, 上下（じょうげ）|Do not elevate unusual alternate kana mixtures or confuse 上る readings.|
|1|下|下（した, below）|下げる（さげる）, 下がる（さがる）, 下車（げしゃ）, 下流（かりゅう）, 下りる（おりる）|Basic verbs should not be rejected for multiple senses; 下さる commonly kana in auxiliary usage.|
|1|水|水（みず, water）|水分（すいぶん）, 水色（みずいろ）, 海水（かいすい）|Single strong Jiten form evidence plus commonness sufficient for primary; missing three ranks not exclusion.|
|2|太|太い（ふとい, thick）|太陽（たいよう）, 太る（ふとる）, 太鼓（たいこ）, 丸太（まるた）|太山 not introductory; names/rare forms not primary examples of タ.|
|2|行|行く（いく, to go）|行う（おこなう）, 旅行（りょこう）, 行列（ぎょうれつ）, 行く（ゆく, alternate）|Standalone verb must be surfaced; use distinct form reading IDs; 行脚 later/reference.|
|2|食|食べる（たべる, to eat）|食事（しょくじ）, 食べ物（たべもの）, 食う（くう, colloquial）|All four sources strongly support 食べる; reject single-sense requirement. 断食 later.|
|2|分|分かる（わかる, to understand）, 分ける（わける, to divide）|自分（じぶん）, 分かれる（わかれる）, 三分（さんぷん）, 五分（ごぶ, half/50% in suitable context）|分ける no candidates; 分かる only phrase-like top candidates; verify okurigana and counter sound changes.|
|2|明|明るい（あかるい, bright）|明らか（あきらか）, 説明（せつめい）, 明ける（あける）, 明かり（あかり）|Missing あける candidates. 明日（あした） whole-word reading; do not force mapping.|
|2|来|来る（くる, to come）|来年（らいねん）, 未来（みらい）, 来る（きたる, formal/attributive）|Basic 来る not prioritized; keep conjugations distinct from independent readings.|

## Regression checks before further bulk review
- For official okurigana readings 一つ, 大きい, 生まれる, 生む, 分ける, 明ける, ensure the exact standard dictionary form is surfaced or an explicit unresolved reason is recorded.
- Verify correct actual reading and scope for 十/じゅう, 十/とお, 十/と; never infer シー is とお from an official spelling example.
- 食べる must qualify as a primary candidate even with several senses. Review 太い and 水 similarly.
- No standalone punctuation in the core lexical ranking; review variant pairs such as これ/此れ without merging distinct senses.
- Inspect the latest kanji.py mapping refinements before requiring a rebuild. Existing saved exports predate these changes. Do not assume the refinements pass these regressions.
- Do not regenerate everything merely to produce the next review. Rebuild affected pilot records with targeted checks when execution is needed, then expand after quality improves.

## Next research step
Review the full Grade 1 set, followed by Grade 2, using compact summaries and targeted form lookup. Review ranking scripts and early/middle cutoff samples independently. Prepare explicit reviewed form IDs and mapping fixes before implementation. Local-only restricted sources remain local; no restricted per-word data in this document.

Sources: [consolidation methods](../consolidation/METHODS.md), [validation aggregates](../consolidation/validation-aggregates.json), [Grade 1 records](../consolidation/kanji/grade-1/), [Grade 2 records](../consolidation/kanji/grade-2/), [government exports](../supplement/README.md). Preserve source notices and applicable ShareAlike terms for source-derived data.
