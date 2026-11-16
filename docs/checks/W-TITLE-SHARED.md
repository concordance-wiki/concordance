# W-TITLE-SHARED

**Severity:** warning. **Family:** documents.

At least three entities of one source share a title, the mark of a template heading kept by every file.

Titles are compared once case and spaces are set aside. The finding lands on the first of the files in path order, quotes the title, counts the entities and names the first three paths. The entities stay separate pages with the same title: in the search results, the trees and the related pages, nothing tells them apart.

A note whose template uses the first heading style of the word processor for every section never reaches this check: with more than one H1, the H1s head its sections and the file name titles the note. The check catches what remains, a template with a single H1 that is a section, and documents whose title property the template filled in once for all.

## Before

```
specs/billing-rules.md     # Purpose of the document
specs/customer-account.md  # Purpose of the document
specs/invoice-export.md    # Purpose of the document
```

```
"Purpose of the document" titles 3 entities of the source specs: billing-rules.md, customer-account.md, invoice-export.md
```

## After

```yaml
sources:
  - name: specs
    path: ../specs
    headings: sections
```

The H1 of every note of the source heads its first section, and the pages are titled "billing-rules", "customer-account" and "invoice-export", from the file names, underscores read as spaces.

## How to fix

When the notes come from a template whose first heading is a section, set `headings: sections` on the source. When a few notes only are concerned, give each one a `title` in its frontmatter. For converted documents, give each file its own title property, or write a markdown note next to it whose H1 titles both.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
