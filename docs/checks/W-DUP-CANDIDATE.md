# W-DUP-CANDIDATE

**Severity:** info. **Family:** documents.

Two resources look like representations of the same document, but not enough to merge them.

The reconciliation score is between 0.5 and 0.9: same base name in different sources, similar text, or added in the same commit. The resources stay separate pages.

## Before

```
framing/payments-workshop.md
meetings/payments-workshop.pptx  (score 0.7)
```

## After

```
---
source: ../meetings/payments-workshop.pptx
---
# Payments workshop
```

## How to fix

Declare the twin explicitly in the markdown frontmatter (`source:`), which scores 1.0, or record the pair as `separated` in the lock file.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
