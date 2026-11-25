# Acquisition handoff

Run `python collect.py` on an internet-connected computer. The script is a draft acquisition utility, syntax checked only; remote execution and exact archive names have not been tested. It records URLs, checksums, sizes and failures. Inspect source terms and file schemas before further processing. The TUBELEX raw path and release asset matching must be confirmed if downloads fail. Do not commit raw files or manifest claims of clearance. Use `raw/` in .gitignore. No complete corpus or ranking is included in this package.

Source references:
- https://github.com/naist-nlp/tubelex/blob/main/README.md
- https://shiberu.app/data/frequency/ja-frequency-2026-README.txt (CC BY 4.0, retain credits)
- https://github.com/scriptin/jmdict-simplified/releases
- https://www.edrdg.org/edrdg/licence.html (regular updates required)
- https://github.com/Doublevil/JmdictFurigana/releases
- https://clrd.ninjal.ac.jp/bccwj/en/freq-list.html (research/education; redistribution unresolved)
- https://www2.ninjal.ac.jp/conversation/cejc-monitor/cejc-wc.html (research-only until cleared)

After acquisition: inspect archive schemas, compare ranks for 太い、太る、太陽、太山、十、大きい、大学、小学校、生活 and other regression cases; distinguish missing from zero frequency. Follow the strategy document for joins, rank fusion, review and licensing. No ranking weights approved yet. Keep grammar and pronunciation out of scope.
