# Shortlist verification review v0.1

Review of the read-only local-database verification committed in `5fdb660fadf99af27d0aa8573b53d27f7ad43ada`. This note separates exact lexical identity from sense choice and from kanji-to-reading mapping. These are research recommendations, not production approvals.

## Grade 1–2 unresolved rows

| Row | Review | Recommended handling |
|---|---|---|
| 千人（せんにん）, Grade 1, later | No exact JMdict form pair exists in the local snapshot. The expression and reading are independently attested: Kotobank has a headword 千人（せんにん）, while EDRDG’s corpus contains 千人以上（せんにんいじょう）. The reading is a productive numeral-plus-counter expression; the missing JMdict ID is not evidence of an incorrect Japanese form. | Keep only as a separately authored counting expression if the curriculum intentionally teaches 千＋人; give it a project-owned stable ID and no JMdict/frequency attribution. Otherwise replace with an exact dictionary example such as 千円 or 千年 after checking the proposed cue. Do not manufacture a JMdict ID or copy spelling-level frequency evidence onto it. |
| 正す（ただす）, Grade 1, later | ID 1376630 is the common unrestricted kanji form with senses “to correct/rectify” and “to straighten/adjust.” IDs 1320660 (“to ask/inquire”) and 1610220 (“to ascertain/confirm”) are marked usually kana and their kanji form is marked irregular. These are distinct senses, not unresolved equivalence. | Select ID 1376630 for an ordinary writing card; use a concise cue such as “to correct; to set right.” Keep the other entries as dictionary reference, not duplicate introductory cards. |
| 元（もと）, Grade 2, initial | ID 1260670 contains the ordinary noun senses “origin/source/beginning,” “basis/foundation,” and related meanings. ID 2219590 is the separate “former/ex/past” entry. The proposed standalone kanji form is a reasonable introductory target but needs a cue to disambiguate the sense. | Select ID 1260670, sense 0 or 1, with cue “origin; source” or “basis; foundation.” Keep ID 2219590 separate for forms such as 元の状態 (“the previous state”), not as the default meaning of this isolated card. |

The outside references support the lexical reading of the compositional expression, not its eligibility as a JMdict-backed or frequency-ranked entry: [Kotobank, 千人](https://kotobank.jp/word/%E5%8D%83%E4%BA%BA-550985); [EDRDG Tanaka corpus index](https://www.edrdg.org/dokuwiki/doku.php?id=wiki_index.php_talk%3Atanaka_corpus). The research database’s absence remains the authoritative result for exact JMdict matching.

## Grade 3–6 ambiguous pairs

The unresolved report contains 34 proposal occurrences but 14 distinct surface/reading pairs. Multiple JMdict IDs may represent separate senses, names, or specialist uses; ambiguity alone is not grounds to discard the surface. The recommended treatment is:

| Surface / reading | Assessment and recommended handling |
|---|---|
| 開けたて（あけたて） | IDs 1202470 (“opening/closing”) and 2855847 (“just opened”) are genuinely different senses. However, the proposal attaches it to 開ける（あける） even though the whole word is あけたて and the exported segmentation maps 開 to あ. This does not support the reading あける. Remove this pair from evidence for 開ける; review 開けたて separately only if it belongs in general vocabulary. |
| 命（みこと） | IDs 1604460 and 1694240 cover honorific/person-address senses. ID 1694240 (“the spoken words of an emperor or noble”) is a legitimate but specialized candidate; ID 1604460 also contains an archaic/derogatory pronoun sense. Keep only as reference or a clearly contextual later item. A nested proposal links this pair to 命（いのち）; reject that reading association. |
| 路上（ろじょう） | ID 1612340 is the ordinary “on the road/street” entry; 5741279 is the Kerouac work title. Keep ID 1612340 for vocabulary. Its 路＝ロ compound mapping is consistent with the segmentation. |
| 位（くらい） | ID 1154340 represents the suffix/particle “about, approximately”; 1155400 represents the noun “rank/position.” The exact spelling/reading does not determine which one the card intends. For a grammar cue use 1154340; for a kanji writing card use 1155400 only with a rank/position context. Avoid an isolated ambiguous cue. |
| 共同（きょうどう） | ID 1591660 is cooperation/shared use; 5220560 is Kyodo News. Use 1591660 for ordinary vocabulary. |
| 鏡（かがみ） | ID 1238550 includes “mirror”; 2017840 is “model/paragon.” Use 1238550 as the default introductory sense. Keep the second sense only with an explicit context, not as a duplicate generic card. |
| 固め（かため） | ID 1266560 has noun senses such as hardening/fortifying; 2763630 means somewhat firm/hard. Both may be legitimate by context. The nested queue associates the form 固め（かため） with the full reading 固める（かためる）. Do not treat this noun form as verification of the full dictionary reading; query 固める directly and use an attested complete form for that reading. |
| 京阪（けいはん） | ID 1233370 is the Kyoto–Osaka area; 5219761 is the railway company. Choose the regional entry only if that is the intended context. Both are proper-name/geography-heavy for an elementary introductory word; consider a more broadly useful example for 阪 if available. |
| 解かす（とかす） | ID 1546040 has melt/dissolve senses (and a colloquial squander sense); ID 1598660 means comb/brush/untangle and is marked usually kana. Use ID 1546040 only with a cue and context that explain 解かす; keep 1598660 reference-only or use the ordinary kana spelling if retained. |
| 解ける（とける） | ID 1198910 covers being solved, coming loose, restrictions lifting, etc.; ID 1546070 covers melting/dissolving and has a colloquial money/time sense. These are distinct sense clusters sharing the same form. Select only with a clear cue (“be solved/come undone” versus “melt/dissolve”); do not let the ambiguous spelling alone set the meaning. |
| 妻（つま） | ID 1294330 is the ordinary “wife” entry. ID 2746070 is edge/gable terminology; 2852371 is archaic endearment. For a general reading card use ID 1294330; the current later proposal pointing to 2746070 should be demoted or replaced. |
| 素性（そせい） | ID 1397290 covers lineage, identity, background, or provenance; 2850177 is “feature.” Use ID 1397290 for the ordinary “background/identity” cue. Keep “feature” only if separately justified by context. |
| 統一（とういつ） | ID 1449670 is the common lexical “unity/unification” entry; 5560631 contains a personal name/organization. Use ID 1449670. |
| 同盟（どうめい） | ID 1599290 is “alliance/union/league”; 5744958 is the historical labor organization Dōmei. Use ID 1599290. |

## Global assessment and next research actions

- Exact pair verification succeeded for every Grade 3–6 candidate pair, but this does **not** validate the legacy kanji-to-reading mapping. 開けたて/あける, 命/いのち, and 固め/かためる expose that distinction directly.
- Promote the three Grade 1–2 identity choices above into a reviewed decision file only after the shortlist itself has an English cue or an approved cue is added. Preserve the no-ID status for 千人 unless it is intentionally modeled as a project-curated expression.
- For Grade 3–6, correct the mismapped nested proposals and replace unhelpful duplicates (notably 妻 and 素性) before calling the queues implementation-ready. Keep proper names, specialist senses, and alternate readings in reference or a contextual later tier.
- Add regression cases for the three mapping failures, sense disambiguation for 元/正す/妻/解ける, and the policy that a compositional counting expression can be a curated curriculum item without a JMdict ID or copied frequency rank.
- Only after these fixes should Codex prepare a versioned, research-only corrected shortlist export. No production app update or deployment is recommended yet.
