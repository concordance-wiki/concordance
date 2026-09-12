---
"@concordance-wiki/core": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/ingest": minor
---

Tolerate content anomalies through findings: every finding now carries a remediation; `build` parses every markdown file after ingestion, turns unreadable files and broken frontmatters into findings without stopping, writes the summary and the sorted findings to `build.log.json` under the output folder (`--output`, `build.output` or `./dist`), prints the summary, and fails only according to `build.fail_on` (`summarize`, `shouldFail` and `serializeBuildLog` in core).
