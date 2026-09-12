---
"@concordance-wiki/lint": minor
"@concordance-wiki/cli": minor
---

Reports for forges: `concordance lint --format json|sarif|junit` prints the findings as a JSON document with the documentation URL on each finding and the counts, as a SARIF 2.1.0 log with one rule per check and one result per finding located by file and line for the diff margin, or as a JUnit suite with one failing test case per error or warning; `--output <file>` writes the report to a file instead of standard output, and the exit codes follow `--fail-on` whatever the format (`formatFindingsAs`, `formatJson`, `formatSarif` and `formatJunit` in the lint package).
