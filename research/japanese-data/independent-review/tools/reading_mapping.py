"""Conservative projection of whole-word readings onto kanji segments.

Only dictionary-attested readings with an exact kana segment and compatible
okurigana are emitted. Rendaku, gemination, jukujikun, ateji, and other
phonological or whole-word inferences remain unresolved without reviewed data.
"""
from __future__ import annotations


def hiragana(text):
    return "".join(chr(ord(ch) - 96) if "ァ" <= ch <= "ヶ" else ch for ch in text)


def parse_kun(policy):
    """Return normalized stem and okurigana from KANJIDIC notation."""
    value = policy.strip("-")
    stem, dot, okuri = value.partition(".")
    return hiragana(stem), hiragana(okuri) if dot else ""


def map_exact_segment(kanji, segment_reading, following_kana, readings):
    """Return a unique dictionary reading candidate or an explicit unresolved result.

    `readings` is a list of records: {value, kind}, where kind is `kun` or `on`.
    For kun readings, `value` uses KANJIDIC dot notation. On readings require
    exact whole segment equality. No surface sound changes are synthesized.
    """
    actual = hiragana(segment_reading)
    following = hiragana(following_kana)
    hits = []
    for item in readings:
        value = item["value"]
        if item.get("kind") == "kun":
            stem, okuri = parse_kun(value)
            if stem == actual and (not okuri or following.startswith(okuri)):
                hits.append(item)
        elif hiragana(value) == actual:
            hits.append(item)
    unique = {(item["kind"], item["value"]) for item in hits}
    if len(unique) == 1:
        return {"status": "exact-dictionary-match", "kanji": kanji,
                "segmentReading": segment_reading, "reading": hits[0]["value"],
                "kind": hits[0]["kind"], "basis": "exact segment and compatible okurigana"}
    if len(unique) > 1:
        return {"status": "ambiguous-dictionary-match", "kanji": kanji,
                "segmentReading": segment_reading,
                "candidates": sorted({value for _, value in unique})}
    return {"status": "unresolved", "kanji": kanji,
            "segmentReading": segment_reading,
            "reason": "no exact dictionary-attested segment match; no sound-change inference applied"}


def validate_mapping_target(status_record, requested_reading):
    """Guard against assigning one reading as evidence for a different one."""
    return (status_record.get("status") == "exact-dictionary-match"
            and status_record.get("reading") == requested_reading)
