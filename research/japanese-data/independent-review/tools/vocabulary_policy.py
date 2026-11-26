"""Frequency-independent coverage checks for a general Japanese word list.

Essential entries are coverage prompts, not fabricated JMdict IDs or frequency
votes. Exact spellings/readings must still be resolved against eligible
dictionary forms; homographs and unresolved senses stay visible.
"""

# The reviewed audit names several omissions. Readings are intentionally absent
# where context-dependent or ambiguous; the verification step must enumerate
# readings rather than guess one.
ESSENTIAL_SURFACES = [
    {"surface": "する", "class": "basic-verb", "reason": "core light verb; kana form"},
    {"surface": "ある", "class": "basic-verb", "reason": "core existence verb; kana form"},
    {"surface": "いる", "class": "basic-verb", "reason": "core animate-existence verb; kana form"},
    {"surface": "ありがとう", "class": "social-expression", "reason": "common expression; kana form"},
    {"surface": "こんにちは", "class": "social-expression", "reason": "common greeting; kana form"},
    {"surface": "あなた", "class": "pronoun", "reason": "common pronoun; usage context required"},
    {"surface": "の", "class": "grammar", "reason": "core particle; keep grammatical function explicit"},
    {"surface": "は", "class": "grammar", "reason": "core particle; homographic readings/senses require review"},
    {"surface": "が", "class": "grammar", "reason": "core particle; homographic readings/senses require review"},
    {"surface": "を", "class": "grammar", "reason": "core particle; keep separate from lexical homographs"},
    {"surface": "に", "class": "grammar", "reason": "core particle; keep separate from lexical homographs"},
    {"surface": "で", "class": "grammar", "reason": "core particle; homographic owners require review"},
    {"surface": "と", "class": "grammar", "reason": "core particle; do not infer standalone kanji reading"},
    {"surface": "も", "class": "grammar", "reason": "core particle"},
]


def essential_coverage(candidates):
    """Return resolved, ambiguous, or missing coverage without altering rank.

    Candidate rows need `jmdictId`, `spelling`, `reading`; sense selection is
    deliberately deferred. A different written variant is not an exact match.
    """
    result = []
    for essential in ESSENTIAL_SURFACES:
        matches = [row for row in candidates if row.get("spelling") == essential["surface"]]
        owners = sorted({row["jmdictId"] for row in matches if row.get("jmdictId") is not None})
        if len(owners) == 1:
            status = "exact-owner-found-review-sense-and-reading"
        elif len(owners) > 1:
            status = "ambiguous-owners-review-required"
        else:
            status = "missing-exact-form-review-alias-or-acquisition"
        result.append({
            **essential, "status": status, "possibleJmdictIds": owners,
            "readings": sorted({row.get("reading") for row in matches if row.get("reading")}),
            "frequencyEvidence": [row.get("ranks") for row in matches if row.get("ranks")],
            "changesExperimentalRank": False,
        })
    return result


def wordfreq_rrf(source_ranks, sources=("shiberu", "tubelex", "wordfreq", "jiten:global"),
                 weights=None, constant=100):
    """Reproduce baseline reciprocal-rank scoring while preserving nulls.

    This returns a score only. It does not deduplicate senses or assign an
    ambiguous surface observation to an entry. The caller must resolve identity.
    """
    weights = weights or {source: 1 for source in sources}
    if constant <= 0:
        raise ValueError("constant must be positive")
    total_weight = sum(weights.get(source, 0) for source in sources)
    if total_weight <= 0:
        raise ValueError("at least one positive source weight is required")
    score = 0.0
    retained = {}
    for source in sources:
        rank = source_ranks.get(source)
        if rank is not None and rank > 0:
            retained[source] = rank
            score += weights.get(source, 0) / (constant + rank)
        else:
            retained[source] = None
    return {"score": score / total_weight, "ranks": retained,
            "observedSourceCount": sum(v is not None for v in retained.values()),
            "rankScope": "per-source rank; not raw-count average"}
