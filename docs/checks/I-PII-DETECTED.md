# I-PII-DETECTED

**Severity:** info. **Family:** vocabulary and filing.

A personal name was detected in a transcript outside the pseudonymisation dictionary.

Speakers are pseudonymised from the dictionary; a name pattern found in the text but absent from it is flagged for review. Nothing is published until you decide.

## Before

```
00:12:04 Speaker 1: as the glossary owner said in the meeting with Firstname Lastname...
```

## After

```yaml
# pseudonyms.yaml
people:
  "Firstname Lastname":
    pseudonym: Participant-4
```

## How to fix

Add the name to `pseudonyms.yaml`, or edit the transcript in its source repository.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
