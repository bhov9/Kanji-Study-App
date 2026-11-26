"""Conservative vocabulary research policies, independent of app/runtime code.

These helpers preserve lexical forms and uncertainty. They deliberately do not
choose an English cue or approve a study card automatically.
"""
from __future__ import annotations

from collections import defaultdict
import unicodedata


def _applies(restrictions, value):
    return not restrictions or "*" in restrictions or value in restrictions


def valid_senses(word, spelling, reading):
    """Return JMdict sense indexes permitted for this exact spelling/reading."""
    return [i for i, sense in enumerate(word.get("sense", []))
            if _applies(sense.get("appliesToKanji", []), spelling)
            and _applies(sense.get("appliesToKana", []), reading)]


def dictionary_form_records(word):
    """Emit dictionary spellings plus kana forms as distinct records.

    A kana form is not called an observed corpus form. JMdict usage tags remain
    visible; absent an explicit preferred spelling override, preference is
    unresolved. Sense restrictions are checked independently for every form.
    """
    records = []
    for kana in word.get("kana", []):
        reading = kana["text"]
        applicable_kanji = [k for k in word.get("kanji", [])
                            if _applies(kana.get("appliesToKanji", []), k["text"])]
        for kanji in applicable_kanji:
            spelling = kanji["text"]
            senses = valid_senses(word, spelling, reading)
            if senses:
                records.append({
                    "jmdictId": word["id"], "surface": spelling, "reading": reading,
                    "formKind": "dictionary-kanji-form", "source": "JMdict",
                    "senseIndices": senses, "kanaTags": kana.get("tags", []),
                    "kanjiTags": kanji.get("tags", []), "preferredForLearners": None,
                })
        # Preserve the exact JMdict kana spelling even when a kanji form exists.
        senses = valid_senses(word, reading, reading)
        if senses:
            usually_kana = "uk" in kana.get("tags", []) or bool(kana.get("common"))
            records.append({
                "jmdictId": word["id"], "surface": reading, "reading": reading,
                "formKind": "dictionary-kana-form", "source": "JMdict",
                "senseIndices": senses, "kanaTags": kana.get("tags", []),
                "kanjiTags": [],
                "preferredForLearners": "candidate" if usually_kana else None,
            })
    return records


def corpus_surface_ledger(observations, surface_owners, curated_resolutions=None):
    """Keep observed spelling evidence surface-level unless identity is resolved.

    `observations` are dictionaries containing source, surface, optional reading,
    and rank. An explicit resolution needs a target ID and rationale; it is
    reported as an override, not converted into independent per-entry votes.
    """
    curated_resolutions = curated_resolutions or {}
    grouped = defaultdict(list)
    for observation in observations:
        grouped[(observation["surface"], observation.get("reading", ""))].append(observation)
    ledger = []
    for (surface, reading), evidence in sorted(grouped.items()):
        owners = sorted(set(surface_owners.get(surface, [])))
        override = curated_resolutions.get((surface, reading))
        if override:
            identity = "curated-resolution-review-required"
            target = override.get("jmdictId")
            if target not in owners or not override.get("rationale"):
                identity = "invalid-curated-resolution"
                target = None
        elif len(owners) == 1:
            identity, target = "unique-owner", owners[0]
        elif owners:
            identity, target = "ambiguous-owner", None
        else:
            identity, target = "unmatched-surface", None
        ledger.append({
            "surface": surface, "reading": reading, "identityStatus": identity,
            "possibleJmdictIds": owners, "curatedTargetId": target,
            "resolutionRationale": override.get("rationale") if override and target else None,
            "observations": sorted(evidence, key=lambda e: (e["source"], e.get("rank", 0))),
        })
    return ledger


def is_core_lexical_surface(surface):
    """Reject isolated punctuation/symbols from lexical curriculum candidates."""
    if not surface:
        return False
    content = [ch for ch in surface if ch not in "ー々〆〇○◎・"]
    return any(unicodedata.category(ch)[0] in ("L", "N") for ch in content)


def historical_id_mapping(old_records, proposed_records):
    """Validate stable word IDs by lexical identity; never reassign an old ID."""
    old_by_id = {r["wordId"]: r for r in old_records}
    proposed_by_id = {r["wordId"]: r for r in proposed_records if "wordId" in r}
    problems = []
    for word_id, old in old_by_id.items():
        new = proposed_by_id.get(word_id)
        if new is None:
            continue
        old_identity = (old.get("spelling"), old.get("reading"))
        new_identity = (new.get("spelling"), new.get("reading"))
        if old_identity != new_identity:
            problems.append({"wordId": word_id, "old": old_identity, "new": new_identity,
                             "reason": "historical ID cannot be reused for a different word"})
    return problems
