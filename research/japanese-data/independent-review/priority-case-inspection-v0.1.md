# Priority candidate spot-check v0.1

This is a targeted inspection of the saved per-kanji JSON exports on the research branch. It is not a full SQLite verification or independent re-lookup of JMdict. In particular, saved `matched` mappings predate the audit and remain unverified. The exact local-database verifier is provided in `tools/verify_shortlists.py`.

| Kanji / candidate | Saved JMdict ID | Saved cue / sense count | Saved frequency ranks (Shiberu, TUBELEX, wordfreq, Jiten global) | Review result |
|---|---:|---|---|---|
| 十 / じゅう | 1579840 | “ten” / 1 | null, null, null, 2241 | Supports 十（じゅう）as the ordinary standalone proposal. The export maps the segment to ジュウ. Keep the standardness judgment distinct from the rank, which is only one media-list rank. |
| 十日 / とおか | 1335000 | “10th day of the month” / 2 | null, null, null, 11589 | Useful compound/whole-word candidate, not standalone evidence for 十（とお）. Do not transfer its whole-word reading to the kanji. |
| 生きる / いきる | 1378520 | “to live” / 5 | 291, 397, 2190, 219 | Retain despite multiple senses; choose the intended sense at card review. |
| 生まれる / うまれる | — | — | — | Absent from the capped saved candidate map. This is not evidence that it is absent from JMdict or the full SQLite database. Run exact shortlist lookup. |
| 大きい / おおきい | — | — | — | Also absent from the saved candidate map. This is a known high-priority false-negative risk; require targeted database lookup. |
| 太い / ふとい | 1408180 | “fat” / 3 | 4053, 1888, 8743, 3226 | The exported first gloss is too narrow for the intended study cue; inspect the applicable sense and use a contextual cue such as “thick” only if supported. The saved mapping is legacy evidence, not revalidated. |
| 太陽 / たいよう | 1408370 | “Sun” / 1 | 445, 1415, 2241, 2035 | Strong ordinary-word proposal; keep the cue concise. The saved mapping is legacy evidence, not revalidated. |
| 食べる / たべる | 1358280 | “to eat” / 2 | 502, 163, 1089, 188 | Keep eligible despite multiple senses and strong evidence across all four lists. Choose a clear sense rather than requiring one dictionary sense. |

## Interpretation

The exports illustrate both key failure modes: very useful okurigana forms can be absent from the capped kanji candidate map, and multi-sense everyday verbs can still have strong evidence. The source ranking should help order review work, not approve cues or mappings. Exact ID/form/sense verification awaits the local SQLite run; no candidate in this note is an implementation approval.
