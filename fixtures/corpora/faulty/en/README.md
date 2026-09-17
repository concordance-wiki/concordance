# Faulty corpus (English)

One file per expected finding. `expected/findings.yaml` lists exactly what the build and the linter must report; the parity test compares both against it.

Not covered here, because they need git history, binary documents or transcripts: `W-STALE`, `W-CONV-FAILED`, `W-CONV-SUSPECT`, `W-DOC-NOMD`, `W-DUP-CANDIDATE`, `I-PII-DETECTED`, `E-ENCODING`, `W-SOURCE-UNREACHABLE`, `W-PLUGIN-DISABLED`, the contract checks that need an imported contract (`W-CONTRACT-UNREACHABLE`, `W-OPERATION-AMBIGUOUS`, `W-OPERATION-UNMATCHED`) and the privacy checks that need a pseudonym dictionary (`W-PRIVACY-DICTIONARY`, `W-PRIVACY-WITHHELD`). They are exercised by the plugin test suites and by unit tests on in-memory fixtures; `scripts/validate.mjs` refuses a check page that neither a fixture produces nor this sentence names.
