# W-DOMAIN-UNCLASSIFIED

**Severity:** info. **Family:** vocabulary and filing.

A note matches no declared domain.

Domains are declared globally by globs across sources, and a frontmatter `domain` overrides them. The note is attached to the unclassified domain. Applications and domains themselves are containers and are never reported.

## Before

```
specs/screens/free-payment-entry.md  (no domain glob matches specs/screens/)
```

## After

```
domains:
  - id: payments
    match: ["**/payment*", "**/payments/**"]
```

## How to fix

Add a glob to the domain in `concordance.yaml`, or set `domain:` in the note's frontmatter.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
