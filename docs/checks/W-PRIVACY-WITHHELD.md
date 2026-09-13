# W-PRIVACY-WITHHELD

**Severity:** warning. **Family:** documents.

A transcript was kept out of the site because its reader cannot rewrite it with the pseudonyms; the raw file is never published.

Under pseudonymisation, the site offers the transcript for download in its pseudonymised form, which the reader of the format writes back from the substituted cues. A reader contributed by a plugin without a `rewrite` function cannot produce that file, and the pipeline copies no transcript it could not rewrite: the page of the meeting shows neither the transcript nor its download, and its text enters neither the model nor the search index.

## Before

```
meetings/2026-06-18-scope/scope.trs   (reader example-transcripts, no rewrite)
```

## After

```
meetings/2026-06-18-scope/scope.vtt   (built-in reader, rewritten with the pseudonyms)
```

## How to fix

Use a reader that implements `rewrite` for the format, or convert the transcript to a format the built-in reader handles, VTT or SRT. The [plugin guide](../guides/plugins.md#readers) describes what a rewrite returns.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
