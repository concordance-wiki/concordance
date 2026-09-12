---
"@concordance-wiki/core": minor
---

Framing transcript publication: `validateConfig` warns when `privacy.publish_transcripts` is `true` without `privacy.pseudonymize.enabled`, since every speaker and every name is then published as written, and reports an error when `privacy.pseudonymize.enabled` is `true` without a `dictionary`; the new guide "Publishing transcripts" sets out what the build hides, what it cannot decide and the obligations to settle before publishing.
