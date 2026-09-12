# Faulty corpus (English)

One file per expected finding. `expected/findings.yaml` lists exactly what the build and the linter must report; the parity test compares both against it.

Not covered here, because they need git history, binary documents or transcripts: `W-STALE`, `W-CONV-FAILED`, `W-CONV-SUSPECT`, `W-DOC-NOMD`, `W-DUP-CANDIDATE`, `I-PII-DETECTED`, `E-ENCODING`, `W-SOURCE-UNREACHABLE` and `W-PLUGIN-DISABLED`. They are exercised by the plugin test suites and by unit tests on in-memory fixtures.
