import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from revise_proposals import mapping, revise


class MappingTests(unittest.TestCase):
    def check(self, char, spelling, reading, stem, suffix, notation):
        parts = [{"ruby": char, "rt": stem}]
        if suffix:
            parts.append({"ruby": suffix})
        return mapping(char, notation.replace(".", ""), spelling, reading, [parts],
                       {"on": [], "kun": [{"sourceNotation": notation}]})

    def test_incomplete_or_different_readings(self):
        for args in [("開", "開けたて", "あけたて", "あ", "けたて", "あ.ける"),
                     ("固", "固め", "かため", "かた", "め", "かた.める"),
                     ("命", "命", "みこと", "みこと", "", "いのち"),
                     ("開", "開けると", "あけると", "あ", "けると", "あ.ける")]:
            with self.subTest(args=args):
                self.assertNotEqual(self.check(*args), "supported")

    def test_full_form_and_segmentation(self):
        self.assertEqual(self.check("固", "固める", "かためる", "かた", "める", "かた.める"), "supported")
        for spelling, kana in [("固めた", "かためる"), ("固める", "かためた")]:
            self.assertNotEqual(self.check("固", spelling, kana, "かた", "める", "かた.める"), "supported")

    def test_all_segmentations_must_support_on_target(self):
        parts = [{"ruby": "路", "rt": "ろ"}, {"ruby": "上", "rt": "じょう"}]
        args = ("路", "ロ", "路上", "ろじょう")
        dictionary = {"on": ["ロ"], "kun": []}
        self.assertEqual(mapping(*args, [parts], dictionary), "supported")
        self.assertNotEqual(mapping(*args, [parts, [{"ruby": "路上", "rt": "ろじょう"}]], dictionary), "supported")


class SenseTests(unittest.TestCase):
    def test_selected_senses(self):
        for spelling, kana, ident, index in [
                ("元", "もと", 1260670, 0), ("正す", "ただす", 1376630, 0),
                ("妻", "つま", 1294330, 0), ("解ける", "とける", 1198910, 0),
                ("素性", "そせい", 1397290, 1), ("位", "くらい", 1155400, 2)]:
            with self.subTest(spelling=spelling):
                result = revise(dict(spelling=spelling, kana=kana),
                                {"matches": [dict(jmdictId=ident, senseIndices=[index])]}, set())
                self.assertEqual((result["jmdictId"], result["senseIndex"]), (ident, index))

    def test_authored_expression_has_own_identity(self):
        item = revise(dict(spelling="千人", kana="せんにん", jmdictId=1, sourceRanks=[1]), {}, set())
        self.assertEqual(item["projectId"], "count-sennin-1000-people")
        self.assertTrue({"jmdictId", "sourceRanks", "frequencyEvidence"}.isdisjoint(item))
