# W-ATTRIBUTE-UNKNOWN

**Severity:** warning. **Family:** identifiers and types.

A frontmatter attribute is declared neither by the type of the note nor among the common attributes of the profile.

The attribute is kept as-is in the model and shown in the side panel of the page, but nothing interprets it: it produces no relation and no typed display. It is often a typo in a key, or an attribute the project profile has yet to declare.

## Before

```
---
url_pattern: /contract/:id/pay
colour: blue
---
# Free payment entry
(file: screens/free-payment-entry.md, typed screen)
```

## After

```
---
url_pattern: /contract/:id/pay
---
# Free payment entry
```

## How to fix

Use an attribute of the type, declare it in the project profile, or remove the key.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
