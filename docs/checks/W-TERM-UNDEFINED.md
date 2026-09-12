# W-TERM-UNDEFINED

**Severity:** warning. **Family:** vocabulary and filing.

A recurring expression is used across files without any note defining it.

The expression scores at least `inference.candidate_score` on C-value × IDF, with at least three occurrences in two files (`inference.ngrams`). It has a keyword page built from its passages, but no definition.

The C-value of an expression is its number of occurrences, minus the mean occurrences of the longer expressions above the thresholds that contain it, multiplied by log2 of its number of words plus one, so that the words of a frequent expression do not surface on their own. The IDF is ln(1 + files in the corpus / files mentioning the expression): an expression spread over every file weighs less than one concentrated in a few.

## Before

```
"build summary": 17 occurrences in 6 files, no note
```

## After

```
glossary/build-summary.md
# Build summary
The counts a build prints last: entities, links, findings by severity.
```

## How to fix

Create a term note in the glossary, or add the expression to `rejected_terms` in the lock file if it is not a business term.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
