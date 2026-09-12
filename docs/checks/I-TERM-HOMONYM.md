# I-TERM-HOMONYM

**Severity:** info. **Family:** vocabulary and filing.

Two entities share a title or an alias once spellings are compared: same form after lower-casing, accent stripping and singularisation.

The recognition dictionary keeps both. Every occurrence of the form links to each entity, at half the confidence it would have with a single target, glossary entities first. The finding names the form and the identifiers of the entities, sorted.

## Before

```
glossary/contract.md        # Contract  (a term)
specs/objects/contract.md   # Contract  (a business object)
```

Every mention of "contract" in the notes links to both entities at half confidence.

## After

```
glossary/contract.md        # Contract
specs/objects/contract.md   # Contract record
```

Or keep both titles and add to each note a `## Not to be confused with` section that points to the other.

## How to fix

Give the entities distinct titles or aliases when they are different things. When the term and the object are the same concept seen from two sides, keep both and add a `## Not to be confused with` section, or link one to the other with `represents`.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
