# W-PRIVACY-DICTIONARY

**Severity:** warning. **Family:** sources.

The pseudonymisation dictionary could not be read or does not match its schema.

`privacy.pseudonymize.dictionary` names a file that is missing, that is not valid YAML, or whose entries do not follow the [pseudonyms schema](../../packages/core/schemas/pseudonyms.schema.json): `version: 1` and one entry per real name with a `pseudonym` and, optionally, a `role`. The message lists every issue with its path in the file.

The severity depends on `privacy.pseudonymize.enabled`. When it is `false`, the dictionary is checked and the finding is a warning: the build goes on, nothing is pseudonymised, as configured. When it is `true`, the finding is raised as an error and the build fails, because a site built without the dictionary would publish every name as written: not publishing is the lesser harm.

## Before

```yaml
# pseudonyms.yaml
version: 1
people:
  "Firstname Lastname": Participant-1
```

```
error: W-PRIVACY-DICTIONARY: pseudonyms.yaml: people["Firstname Lastname"]: must be object
```

## After

```yaml
# pseudonyms.yaml
version: 1
people:
  "Firstname Lastname":
    pseudonym: Participant-1
    role: Maintainer
```

## How to fix

Fix the path of `privacy.pseudonymize.dictionary`, relative to `concordance.yaml`, or the file it names. Keep the file out of every public repository: it is the mapping from pseudonyms back to people.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
