# E-ENCODING

**Severity:** error. **Family:** identifiers and types.

The file is not valid UTF-8.

The file is skipped entirely: nothing of it enters the model, and every link that points to it is reported as broken.

## Before

A file saved in Latin-1 or Windows-1252: an accented letter is a single byte that no UTF-8 decoder accepts.

```
# R�sum�
```

## After

The same file saved as UTF-8, with or without a byte order mark.

```
# Résumé
```

## How to fix

Convert the file to UTF-8 with your editor or with `iconv -f latin1 -t utf-8`. Ask the repository to enforce UTF-8 through `.editorconfig` (`charset = utf-8`) so that the mistake does not come back.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
