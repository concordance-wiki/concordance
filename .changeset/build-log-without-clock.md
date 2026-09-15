---
"@concordance-wiki/core": patch
"@concordance-wiki/cli": patch
"@concordance-wiki/site": patch
---

The `duplicates` block of `build.log.json` no longer carries `timeMs`, so that nothing in the log depends on the clock but its `at` field; the console summary still prints the measured duration of the twin-resource reconciliation. A missing theme file is told apart from an invalid one by a `missing` flag on the failed load rather than by the text of its message; the exit codes and the messages are unchanged.
