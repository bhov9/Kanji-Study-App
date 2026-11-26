import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from lexical_policy import (corpus_surface_ledger, dictionary_form_records,
                            historical_id_mapping, is_core_lexical_surface)
from reading_mapping import map_exact_segment
from verify_shortlists import verify
from vocabulary_policy import essential_coverage, wordfreq_rrf
from generate_higher_grade_shortlists import read_record


def word(ident, spelling, reading, glosses, senses, kana_tags=None):
    return {
        "id": ident,
        "kanji": [{"text": spelling, "tags": []}] if spelling != reading else [],
        "kana": [{"text": reading, "tags": kana_tags or [], "common": True}],
        "sense": [{"gloss": [{"lang": "eng", "text": g} for g in gloss],
                   "partOfSpeech": ["v1"], "misc": [],
                   "appliesToKanji": [], "appliesToKana": []} for gloss in glosses],
    }


class ResearchPolicyTests(unittest.TestCase):
    def test_kana_and_kanji_dictionary_forms_are_separate(self):
        record = word(10, "有る", "ある", [["to exist"], ["to have"]], 2)
        forms = dictionary_form_records(record)
        self.assertEqual({f["formKind"] for f in forms},
                         {"dictionary-kanji-form", "dictionary-kana-form"})
        self.assertEqual({f["surface"] for f in forms}, {"有る", "ある"})
        self.assertTrue(all(f["senseIndices"] == [0, 1] for f in forms))

    def test_sense_specific_spelling_restriction_is_respected(self):
        record = word(11, "生まれる", "うまれる", [["to be born"], ["figurative"]], 2)
        record["sense"][1]["appliesToKanji"] = ["生"]
        forms = dictionary_form_records(record)
        kana = next(f for f in forms if f["formKind"] == "dictionary-kana-form")
        self.assertEqual(kana["senseIndices"], [0])

    def test_ambiguous_corpus_surface_is_retained_without_duplication(self):
        rows = corpus_surface_ledger(
            [{"source": "wordfreq", "surface": "は", "rank": 5}],
            {"は": [1, 2]},
        )
        self.assertEqual(rows[0]["identityStatus"], "ambiguous-owner")
        self.assertIsNone(rows[0]["curatedTargetId"])
        self.assertEqual(rows[0]["observations"][0]["rank"], 5)

    def test_curated_surface_resolution_requires_owner_and_rationale(self):
        good = corpus_surface_ledger(
            [{"source": "tubelex", "surface": "する", "rank": 1}],
            {"する": [42]},
            {("する", ""): {"jmdictId": 42, "rationale": "reviewed function-verb entry"}},
        )[0]
        bad = corpus_surface_ledger(
            [{"source": "tubelex", "surface": "する", "rank": 1}],
            {"する": [42]},
            {("する", ""): {"jmdictId": 99, "rationale": "wrong owner"}},
        )[0]
        self.assertEqual(good["identityStatus"], "curated-resolution-review-required")
        self.assertEqual(bad["identityStatus"], "invalid-curated-resolution")

    def test_punctuation_cannot_be_core_vocabulary(self):
        self.assertFalse(is_core_lexical_surface("。"))
        self.assertFalse(is_core_lexical_surface("ー"))
        self.assertTrue(is_core_lexical_surface("ありがとう"))

    def test_reading_mapping_handles_okurigana_without_guessing(self):
        readings = [{"value": "た.べる", "kind": "kun"}]
        self.assertEqual(map_exact_segment("食", "た", "べる", readings)["status"],
                         "exact-dictionary-match")
        self.assertEqual(map_exact_segment("山", "ざん", "", [{"value": "やま", "kind": "kun"}])["status"],
                         "unresolved")

    def test_ten_uses_attested_juu_and_rejects_false_shii_link(self):
        readings = [{"value": "じゅう", "kind": "on"}, {"value": "とお", "kind": "kun"}]
        self.assertEqual(map_exact_segment("十", "じゅう", "", readings)["reading"], "じゅう")
        self.assertEqual(map_exact_segment("十", "シー", "", readings)["status"], "unresolved")

    def test_historical_word_id_cannot_change_identity(self):
        issues = historical_id_mapping(
            [{"wordId": "w17", "spelling": "食べる", "reading": "たべる"}],
            [{"wordId": "w17", "spelling": "食う", "reading": "くう"}],
        )
        self.assertEqual(issues[0]["wordId"], "w17")

    def test_essential_coverage_does_not_invent_or_rank_ids(self):
        report = essential_coverage([
            {"jmdictId": 7, "spelling": "する", "reading": "する", "ranks": {"tubelex": 9}},
            {"jmdictId": 8, "spelling": "は", "reading": "は"},
            {"jmdictId": 9, "spelling": "は", "reading": "は"},
        ])
        by_surface = {row["surface"]: row for row in report}
        self.assertEqual(by_surface["する"]["status"], "exact-owner-found-review-sense-and-reading")
        self.assertEqual(by_surface["は"]["status"], "ambiguous-owners-review-required")
        self.assertEqual(by_surface["こんにちは"]["status"], "missing-exact-form-review-alias-or-acquisition")
        self.assertFalse(by_surface["する"]["changesExperimentalRank"])

    def test_rrf_retains_null_source_observations_and_uses_ranks_not_counts(self):
        scored = wordfreq_rrf({"tubelex": 10, "wordfreq": None})
        self.assertEqual(scored["ranks"]["tubelex"], 10)
        self.assertIsNone(scored["ranks"]["wordfreq"])
        self.assertEqual(scored["observedSourceCount"], 1)
        self.assertIn("not raw-count", scored["rankScope"])

    def test_higher_grade_generator_labels_legacy_mapping_unverified(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "乗.json"
            path.write_text(json.dumps({
                "character": "乗", "grade": 3,
                "readings": [{"reading": "のる", "official": True, "category": "preferred",
                              "candidates": ["123/乗る/のる"]}],
                "candidates": {"123/乗る/のる": {"id": 123, "form": "乗る", "kana": "のる",
                    "gloss": "to ride", "senses": [0, 1], "pos": ["v5r"], "flags": [],
                    "common": True, "ranks": [100, None, 200, None],
                    "matched": {"のる": {"actual": "の", "dictionary": ["の.る"]}}}},
            }), encoding="utf-8")
            result = read_record(path)
            proposal = result["readingProposals"][0]["proposals"][0]
            self.assertEqual(proposal["jmdictId"], 123)
            self.assertEqual(proposal["mappingStatus"], "legacy-export-mapping-unverified")
            self.assertEqual(proposal["senseIndices"], [0, 1])

    def test_shortlist_verifier_marks_multiple_entry_matches_ambiguous_read_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            db = root / "research.sqlite"
            conn = sqlite3.connect(db)
            conn.executescript("""
              CREATE TABLE entry(id INTEGER PRIMARY KEY, dictionary_json TEXT NOT NULL);
              CREATE TABLE form(id INTEGER, spelling TEXT, reading TEXT, sense_indices TEXT, common INTEGER);
              CREATE TABLE evidence(source TEXT, spelling TEXT, reading TEXT, rank INTEGER, metadata TEXT);
              CREATE TABLE segmentation(spelling TEXT, reading TEXT, segments TEXT);
            """)
            for ident in (1, 2):
                conn.execute("INSERT INTO entry VALUES(?,?)", (ident, json.dumps(word(ident, "生まれる", "うまれる", [["to be born"]], 1), ensure_ascii=False)))
                conn.execute("INSERT INTO form VALUES(?,?,?,?,?)", (ident, "生まれる", "うまれる", "[0]", 1))
            conn.execute("INSERT INTO evidence VALUES(?,?,?,?,?)", ("wordfreq", "生まれる", "", 30, "{}"))
            conn.commit()
            conn.close()
            shortlist = root / "shortlist.json"
            shortlist.write_text(json.dumps({"records": [{"kanji": "生", "grade": 1,
                "initial": [{"spelling": "生まれる", "kana": "うまれる"}], "later": []}]}), encoding="utf-8")
            report = verify(db, [shortlist])
            row = report["records"][0]
            self.assertEqual(row["status"], "ambiguous-exact-match-review-required")
            self.assertEqual(row["frequencyEvidence"][0]["identityStatus"], "ambiguous-owner")
            conn = sqlite3.connect(db)
            self.assertEqual(conn.execute("SELECT count(*) FROM form").fetchone()[0], 2)
            conn.close()


if __name__ == "__main__":
    unittest.main()
