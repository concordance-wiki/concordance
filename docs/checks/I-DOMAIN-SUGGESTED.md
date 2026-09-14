# I-DOMAIN-SUGGESTED

**Severity:** info. **Family:** vocabulary and filing.

An unclassified note lies within the radius of a pivot of the neighbourhood: a candidate for a domain named after it.

The proposal runs only when `concordance.yaml` sets [`inference.domains`](../guides/configuration.md#inferencedomains). Every term with a note of its own whose degree in the graph of typed links and co-occurrence neighbours reaches `min_neighbours` is a pivot; stopwords and the `rejected_terms` of the lock file never are. Every note no frontmatter, folder or glob files that lies within `radius` edges of a pivot is attached to the closest one, at equal distance to the pivot of highest degree, then to the first in code-unit order of its identifier. The domain proposed is named after the last segment of the pivot's identifier. The message names the note, the distance, the pivot and its degree; the pivot itself is reported at distance zero. The build summary and `build.log.json` list every pivot with its degree and the notes it reaches under `domains`.

## Before

```
glossary/check.md          (a term cited by fourteen notes)
specs/roles/maintainer.md  (cites glossary/check; no domain folder and no domain glob matches roles/maintainer.md)
```

```
specs/roles/maintainer lies within 1 of glossary/check (degree 14): a candidate for a domain named "check" after it
```

## After

```
domains:
  - id: check
    match: ["**/roles/**"]
```

or, in `concordance.lock.yaml`:

```
domains:
  specs/roles/maintainer: check
```

## How to fix

Promote the proposal into a declaration: add a domain named after the pivot under `domains` in `concordance.yaml` with a folder or a glob that claims the note, or record the note under `domains` in the [lock file](../guides/configuration.md#lock), which files it with the origin `lock`. A domain declared by frontmatter, folder or glob always wins over the lock. To let the build file every reached note itself, set `inference.domains.assign: true`: the note takes the domain named after its pivot with the origin `inferred`, and swings to another pivot when the corpus grows, which is why nothing is assigned by default.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
