# Faulty corpus (English)

One file per expected finding. `expected/findings.yaml` lists exactly what the build and the linter must report; the parity test compares both against it.

Not covered here, because they need git history, binary documents or transcripts: `W-STALE`, `W-CONV-FAILED`, `W-CONV-SUSPECT`, `W-DOC-NOMD`, `W-DUP-CANDIDATE`, `I-PII-DETECTED`. They are exercised by the `realistic` corpus and by the plugin test suites.
