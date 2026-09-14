---
"@concordance-wiki/core": patch
"@concordance-wiki/lint": patch
---

Commands are located by an absolute path, never by a name looked up on the `PATH`: the build takes `git` from the system directories of the platform, or from `CONCORDANCE_GIT`; the linter orders the suffixes of a source by code unit, as every other list.
