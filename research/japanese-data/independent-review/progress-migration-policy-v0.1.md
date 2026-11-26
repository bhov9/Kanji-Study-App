# Study progress migration policy v0.1

Research-only policy based on the production application at `main` commit `d70055576c40b91fd40f7180f4e7d27f3d9f27a3`. No app code or stored data was changed.

## Observed production format

- The browser stores progress under `localStorage` key `kanji-practice.progress`.
- `study.js` currently creates progress at schema version `3`, with `characters` and an append-only `reviews` array. Existing state is character-based; review records contain a stable `wordId`, target `character`, outcome, timestamp, and due date. The progress editor and memorized controls update character state.
- `data.js` documents that stable word IDs are recorded in review history and must be retained when editing a word. Current examples include stable string IDs in the starter deck and `jmdict:<id>` IDs in generated rows.
- Export creates a JSON backup of progress plus feedback. Import validates progress and feedback, then replaces the saved data after a confirmation. The schema validator and feedback validation live in `study.js` / `feedback.js`.
- The production app currently studies kanji, not independent vocabulary. Its scheduling algorithm must remain unchanged during curriculum research.

## Migration rules for future vocabulary data

1. Preserve every valid historical review object and its original `wordId`, even if that word is retired from new prompts. A stable ID may never be reassigned to a different spelling/reading identity.
2. Correct a cue or explanatory metadata in place only when the lexical identity remains the same. A changed spelling, reading, or lexical sense that changes the identity receives a new ID and an explicit old-to-new relationship; it does not inherit mastery automatically.
3. Preserve character-level kanji progress independently of vocabulary progress. Do not let a new word reset, satisfy, or transfer a memorized kanji state.
4. Give general vocabulary its own progress namespace and schema. Do not merge its reviews into the current kanji `characters` or scheduling code. Each vocabulary card should track identity at least by stable entry/form/reading or another documented stable key.
5. Preserve a memorized flag only for the same validated lexical identity. For a changed or split reading, keep the old history attached to the old ID and start the new identity without mastery.
6. Keep export/import backward-compatible: recognize existing version-3 kanji backups, preserve feedback, and add vocabulary state in a separately versioned, optional field. Round-trip older backups without dropping unknown-but-valid historical review IDs.
7. Do not rewrite or compact review history merely to conform to a new deck. Migration must be deterministic, idempotent, and tested on copies of backups before an app release.

This is a design policy only. Do not run it against user storage or change the scheduler as part of research.
