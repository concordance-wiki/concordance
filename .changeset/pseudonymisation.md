---
"@concordance-wiki/core": minor
---

Transcript pseudonymisation: `loadPseudonymDictionary` reads `pseudonyms.yaml` against the new published `pseudonyms.schema.json`, `pseudonymizeText` replaces every real name of the dictionary on word boundaries, case- and accent-insensitively and longest name first, by its pseudonym or its role under `keep_roles`, `pseudonymizeSpeaker` numbers unknown speakers `Speaker-<n>` by first appearance, `detectPersonalMentions` finds capitalised name patterns outside the dictionary, `pseudonymizeTranscript` applies all of it to a transcript before anything renders or indexes it and reports every unknown mention as `I-PII-DETECTED`, and `transcriptsPublished` says whether `privacy.publish_transcripts` was explicitly requested.
