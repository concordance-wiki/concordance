# W-TERM-UNUSED

**Severity:** info. **Family:** vocabulary and filing.

A glossary term is never cited anywhere.

Neither its title nor its aliases appear in any other file. The term may be obsolete, or its usual spelling may be missing from `aliases`.

## Before

```
---
aliases: []
---
# Scheduled contribution
```

## After

```
---
aliases: [scheduled payment, standing payment]
---
# Scheduled contribution
```

## How to fix

Add the spellings people use as `aliases`, or mark the term `status: obsolete`.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
