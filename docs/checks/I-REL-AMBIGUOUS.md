# I-REL-AMBIGUOUS

**Severity:** info. **Family:** vocabulary and filing.

A link between two entities fell back to the generic `related` relation.

No mapped section, no typed frontmatter attribute, and the profile allows none or several relations between these two types, so the type pair cannot name the relation either. The link is kept at a confidence capped at 0.6, whatever the methods behind it, and displayed with the label of `related`. The finding is raised once per link by the relation typing step, on the file and line of the link's first provenance that names a file: the note the mention or the written link was read in. A link whose provenances are all co-occurrences raises nothing: a co-occurrence names no file and is unnamed by nature, the finding is for a link an author wrote or a mention the scan located.

## Before

```
# Entity page

The screen reads the entity and updates its neighbourhood.
```

## After

```
# Entity page

## Objects
- Reads: [entity](../objects/entity.md)
- Writes: [neighbourhood](../objects/neighbourhood.md)
```

## How to fix

Move the mention under a mapped section, or declare the reference in frontmatter (`reads`, `writes`).

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
