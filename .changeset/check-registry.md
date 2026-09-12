---
"@concordance-wiki/checks": minor
---

Shared check registry: a catalogue of every documented check with its default severity, family, description, remediation and documentation URL, five checks computed as pure functions over the model (`W-API-NOCONSUMER`, `W-API-CONSUMER-MISMATCH`, `W-APP-MISSING`, `W-DOMAIN-UNCLASSIFIED`, `I-REL-AMBIGUOUS`), and `createRegistry` which merges plugin contributions, runs the enabled checks, applies the `checks:` overrides to computed and step findings alike and refuses an unknown identifier.
