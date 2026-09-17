# I-TERM-HOMONYM

**Severity:** info. **Family:** vocabulary and filing.

Two entities share a title or an alias once spellings are compared: same form after lower-casing, accent stripping and singularisation.

The recognition dictionary keeps both. Every occurrence of the form links to each entity, at half the confidence it would have with a single target, glossary entities first. The finding lands on the note of the first entity (glossary first, then by identifier), names the form as that note writes it and the identifiers of the entities, sorted.

A twin folded into its note is not a homonym: the twin resources are reconciled before the dictionary is built, so a converted document whose title is the heading of a note, or two notes merged on their base names, lend their titles and aliases to the one entity they became, and a form the two share names that entity once, at full confidence.

## Before

```
glossary/source.md        # Source  (a term)
specs/objects/source.md   # Source  (a business object)
```

Every mention of "source" in the notes links to both entities at half confidence.

## After

```
glossary/source.md        # Source
specs/objects/source.md   # Source record
```

Or keep both titles and add to each note a `## Not to be confused with` section that points to the other.

## How to fix

`concordance lint --scope global` reports the same finding from one repository, for a local title or alias that an entity of another type carries in the published model, naming that entity.

Give the entities distinct titles or aliases when they are different things. When the term and the object are the same concept seen from two sides, keep both and add a `## Not to be confused with` section, or link one to the other with `represents`.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
