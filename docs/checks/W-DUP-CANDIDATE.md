# W-DUP-CANDIDATE

**Severity:** info. **Family:** documents.

Two resources look like representations of the same document, but not enough to merge them.

The reconciliation score is between 0.5 and 0.9. The message names the score and every signal that contributed: `declared in the frontmatter of <path>` (1.0), `same base name in the same folder` (0.7), `in another folder` or `across sources` (0.5), `similar base names` with the Jaro-Winkler value (those weights times 0.8), `title equal to the heading` (0.6), `similar content` with the estimated or exact Jaccard index and, after an exact verification, the share of lines in common (0.7 from 0.8, 0.4 from 0.6), `added in commit <hash>` (0.3) and `directory proximity` (up to 0.2). When the two texts differ too much in size, the content signal is capped at 0.4 and reads `similar content, very different sizes: an inclusion rather than a duplicate`. The resources stay separate pages.

## Before

```
framing/payments-workshop.md
meetings/payments-workshop.pptx
```

```
docs/framing/payments-workshop.md and docs/meetings/payments-workshop.pptx look like two representations of one document (score 0.50: same base name in another folder 0.50); they stay separate
```

## After

```
---
source: ../meetings/payments-workshop.pptx
---
# Payments workshop
```

## How to fix

Declare the twin explicitly in the markdown frontmatter (`source:`), which scores 1.0 and merges the pair, or record the pair under `merged` or `separated` in the lock file. The thresholds and the text comparison are configured under [`inference.duplicates`](../guides/configuration.md#inferenceduplicates).

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
