# W-TYPE-UNKNOWN

**Severity:** warning. **Family:** identifiers and types.

The resolved type of a note is not declared by the profile.

The type cascade (source `default_type` and `type`, typing rules, frontmatter `type`) produced a slug that neither the default profile nor the project profile declares. The note is kept and treated as a `document`; its type origin is recorded as it was resolved, so the site shows where the unknown type came from.

## Before

```
---
type: regulation
---
# Publication threshold
(profile.yaml declares no regulation type)
```

## After

```
types:
  regulation:
    label: { en: Regulation, fr: Réglementation }
    group: motivation
```

## How to fix

Use a type of the profile, declare the type in the project profile, or fix the source rule or the frontmatter that sets it.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
