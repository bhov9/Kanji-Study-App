# Government readings and educational vocabulary

Research snapshot for the Japanese study app, acquired 25 November 2026. All exports in this directory were prepared by the project. The government agencies published the underlying tables.

## Reading evidence

| File | Contents |
|---|---|
| `joyo.jsonl` | 2,136 character records in official order, 4,388 readings, 9,555 example items and 504 character rows with notes. Each reading has an example array at the same index. Ten readings have an empty example array. The examples include phrases, spelling illustrations and inflected forms. |
| `stages.jsonl` | One row per character and reading, with the stage indicated by the circle in the March 2017 MEXT table, PDF page, elementary character grade if listed, and the source's indentation flag for special or narrow usage. |
| `appendices.jsonl` | 116 supplementary word-reading groups and 12 prefectural readings. Alternative spellings share a record. Appendix 1 includes whole-word readings that cannot be assigned to individual characters. |

The Agency's 2010 index supplies the full readings, examples and usage notes. The extraction preserves character headings with variant forms and notes at character level. It joins wrapped example lines and splits examples at the publisher's full-width comma. Notes may contain cross-references, alternate spellings or readings restricted to particular words. [Agency for Cultural Affairs reading index](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/joyokanjisakuin/index.html)

The representative index was read from all 43 section pages. The Agency defines the representative as the first listed reading. Every representative matches the first reading in the full index. The published image alt text uses 叱 for the index position corresponding to 𠮟. Both spellings are preserved. Glyph illustrations are omitted. [Agency for Cultural Affairs representative index](https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/joyokanjihyo_sakuin/index.html)

All 4,388 distinct MEXT character-reading pairs matched the full Agency index. MEXT allocates 2,062 readings to elementary school, 2,008 to junior high and 318 to senior high. Schools may adjust instruction to local needs. For example, 生 has elementary assignments for セイ, ショウ and いきる, and junior-high assignments for おう and き. The stage applies to the reading. The separate grade field applies to the character. The extractor follows the three blocks in page order, uses circle positions for stages and carries headings across column and page breaks. One heading, 𠮟 on PDF page 20, required visual verification because its glyph was absent from the text layer. [MEXT table and guidance](https://www.mext.go.jp/a_menu/shotou/new-cs/1385768.htm)

The Japanese government text and data were reformatted under the MEXT website terms, which cover both source domains, require attribution and disclosure of edits, and reserve third-party rights. [MEXT usage policy](https://www.mext.go.jp/b_menu/1351168.htm)

## Frequency evidence

| Resource | Snapshot and unit |
|---|---|
| wordfreq 3.1.1 | 214,960 Japanese tokens in the large list and 30,215 in the small list. The small list is a separate view. Both original MessagePack files are included. `wordfreq-ja.tsv` contains the large list as token, tied rank and Zipf score. |
| BCCWJ v1.1 | 185,136 short-unit lexical records and 2,434,721 long-unit records in the complete tables, including singletons. The publisher supplies ranks, readings, POS, counts, rates and register columns. |
| NINJAL Textbook Corpus v1.0 | 50,329 lexical records with positive textbook counts. The 204 fields include lexical identifiers, POS, frequency, usage rates and distinctiveness by school grouping and subject. The 2011 release describes textbooks used in the 2005 school year. |
| Subject-specific lists | 8,005 entries across 17 worksheets, eight junior-high and nine high-school subjects. Subject counts include words appearing in multiple lists. The lists measure distinctiveness against library books. |

The full registry of fields and counts per workbook is in `frequency-inventory.json`. The wordfreq Zipf score is calculated from the published centibel bin. All tokens in a bin share its first rank. The derived TSV and the original Japanese data files are distributed under CC BY-SA 4.0 with the publisher's credits. [wordfreq project](https://github.com/rspeer/wordfreq) · [License and source acknowledgments](wordfreq-credits.md)

The NINJAL repository labels all three downloads CC BY-NC-ND 3.0. For this app, the originals and their per-word research exports are local. Both BCCWJ archives matched the publisher's SHA-256 checksums. [Short units](https://repository.ninjal.ac.jp/records/3235/file_details/BCCWJ_frequencylist_suw_ver1_1.zip) · [Long units](https://repository.ninjal.ac.jp/records/3229/file_details/BCCWJ_frequencylist_luw_ver1_1.zip) · [Textbooks and subject lists](https://repository.ninjal.ac.jp/records/3301/file_details/LR-CCG-10-07-CD-ROM.zip)

## Local outputs and reproduction

Paths below are relative to `research/japanese-data/`.

- `local/supplement/` contains the source snapshots. The 50 entries in `supplement/manifest.json` give exact filenames, URLs, sizes and SHA-256 hashes. The government resources are `joyo.html`, `representative.html`, `table_*.html` and `mext.pdf`. The frequency sources are `wordfreq.whl`, `short.zip`, `long.zip` and `textbooks.zip`.
- `local/supplement/subjects.jsonl` preserves each subject's worksheet fields and source label. The raw textbook table is the UTF-16 tab-separated member ending in `1_教科書/教科書.txt` inside `textbooks.zip`.
- `local/supplement/comparison.json` compares 17 spellings across eight frequency lists using exact source spelling. Homographs retain separate rows and missing spellings have null values. The textbook rank is one plus the number of lexical records with higher all-subject counts. Short units, long units and multi-source tokens have different segmentation. BCCWJ v1.0 and v1.1 are related versions of the same corpus.
- `local/supplement/overlap.json` gives the top-1,000 spelling overlap for all 28 source pairs. A spelling qualifies if any lexical record ranks 1,000 or better, including ties. No corpus weights are assigned.
- With Python 3.11+, install `lxml`, `pdfplumber`, `msgpack` and `xlrd` in the Python environment. Run `python supplement/acquire.py`, `python supplement/government.py` and `python supplement/frequency.py`. The frequency comparison also reads the previous research snapshot's `local/comparison.json` and `local/ranks.jsonl`, reproducible with the parent directory's `review.py`. The acquisition script verifies exact snapshot hashes. If a publisher revises an unversioned HTML page, the check flags the new content for review.
