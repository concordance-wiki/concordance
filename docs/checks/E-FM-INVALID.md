# E-FM-INVALID

**Severity:** error. **Family:** identifiers and types.

The YAML frontmatter cannot be parsed.

The body of the file is still processed, but every attribute of the frontmatter is lost, including the type, the aliases and the references.

## Before

```
---
title: Free payment
aliases: [FP, free contribution
---
# Free payment
```

## After

```
---
title: Free payment
aliases: [FP, free contribution]
---
# Free payment
```

## How to fix

Fix the YAML. Quote values that contain `:` or `#`.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
