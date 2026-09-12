# I-REL-AMBIGUOUS

**Severity:** info. **Family:** vocabulary and filing.

A link between two entities fell back to the generic `related` relation.

No mapped section, no typed frontmatter attribute, and the profile allows more than one relation between these two types. The link is kept at a confidence capped at 0.6 and displayed as "related".

## Before

```
# Free payment entry

The screen reads the contract and updates its balance.
```

## After

```
# Free payment entry

## Objects
- Reads: [contract](../objects/contract.md)
- Writes: [contract](../objects/contract.md)
```

## How to fix

Move the mention under a mapped section, or declare the reference in frontmatter (`reads`, `writes`).

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
