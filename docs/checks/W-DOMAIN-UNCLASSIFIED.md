# W-DOMAIN-UNCLASSIFIED

**Severity:** info. **Family:** vocabulary and filing.

A note matches no declared domain.

Domains are declared globally, by a folder name looked for on the path of every file inside its source (`folder: true` for a folder named after the identifier, `folder: <name>` for another), by globs evaluated on that path, or both; a frontmatter `domain` overrides them. The note is attached to the `unclassified` domain, which the entity records as its `domain`. Applications and domains themselves are containers and are never reported.

## Before

```
specs/screens/keyword-page.md  (no domain folder and no domain glob matches screens/keyword-page.md)
```

## After

```
domains:
  - id: publication
    folder: screens
    match: ["**/*page*"]
```

## How to fix

Add a folder or a glob to the domain in `concordance.yaml`, or set `domain:` in the note's frontmatter.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
