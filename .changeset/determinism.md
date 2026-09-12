---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
---

Reproducible builds: `SOURCE_DATE_EPOCH` pins the clock of the command line (`epochClock` in core), `compareLinks`, `compareProvenances` and `sortCanonically` give links and provenances their canonical order next to findings, and a double-build test plus the determinism step of `pnpm check` compare every output file of two builds of the golden corpus byte for byte.
