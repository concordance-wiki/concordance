---
"@concordance-wiki/core": patch
---

A malformed glob under `privacy.exclude` or under a typing rule's `match.path` is a configuration error, as one under `domains[].match` already was: it used to be accepted and to match nothing in silence.
