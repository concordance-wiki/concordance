# W-TERM-UNDEFINED

**Severity:** warning. **Family:** vocabulary and filing.

A recurring expression is used across files without any note defining it.

The expression scores above `inference.candidate_score` on C-value × IDF, with at least three occurrences in two files. It has a keyword page built from its passages, but no definition.

## Before

```
"exceptional payment": 17 occurrences in 6 files, no note
```

## After

```
glossary/exceptional-payment.md
# Exceptional payment
A payment outside the contractual frame, validated by the branch manager.
```

## How to fix

Create a term note in the glossary, or add the expression to `rejected_terms` in the lock file if it is not a business term.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
