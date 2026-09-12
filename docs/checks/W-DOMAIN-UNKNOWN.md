# W-DOMAIN-UNKNOWN

**Severity:** warning. **Family:** vocabulary and filing.

A frontmatter `domain` names no declared domain.

The frontmatter wins over the domain globs, so a value that matches neither the identifier nor the identifier path (`inference/recognition`) of a domain declared under `domains:` is most often a typo, or a domain the configuration has yet to declare. The value is kept as written on the entity, so the site shows what the author meant; nothing files the note under a declared domain.

## Before

```
---
domain: recognized
---
# Keyword page
(concordance.yaml declares inference and its subdomain recognition)
```

## After

```
---
domain: recognition
---
# Keyword page
```

## How to fix

Name a declared domain by its identifier or its identifier path, or declare the domain under `domains:` in `concordance.yaml`.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
