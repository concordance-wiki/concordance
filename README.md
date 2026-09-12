# Concordance

Concordance turns git repositories of markdown into a wiki that shows where every business word is used.

A team keeps its functional knowledge in markdown: meeting transcripts, specifications, framing notes, a glossary, a data model, decisions. Nothing links a glossary term to the specifications that use it, a screen to the objects it handles, a decision to what it affects. Concordance reads those repositories as they are, records the occurrences of every business word from one file to the next, and publishes one page per word, whether or not someone wrote a note about it.

## What it does

- Reads several git repositories of standard markdown (CommonMark, GFM, optional YAML frontmatter) without requiring any rework of the content.
- Publishes one page per word: the written note first when it exists, at most five declared properties, then every passage that mentions the word elsewhere.
- Recognises typed notes (screen, rule, business object, API, process, decision) by filing convention and derives links between them, each carrying a confidence score and a provenance.
- Previews office documents and transcripts, and reconciles them with their markdown twins.
- Imports API contracts (OpenAPI, WSDL) as the source of truth for operations.
- Ships a linter to wire into the continuous integration of every knowledge repository.
- Produces a static site: nothing to run to browse it.

The meta-model is configuration. Types, relations, sections, confidence scale, checks and theme live in a YAML profile; the engine only knows "type, attributes, relations, score".

## Status

Pre-alpha. The repository holds the specification, the default profile, the published schemas, the reference corpora and the documentation. The engine is not written yet; nothing is published to npm.

The project is licensed under the GNU General Public License, version 3 or later. Intellectual property validation is still pending before the first release.

## Documentation

- [MVP specification](docs/spec/mvp.md)
- [Target requirements](docs/spec/requirements.md)
- [Architecture](docs/guides/architecture.md)
- [Getting started](docs/guides/getting-started.md)
- [Configuration](docs/guides/configuration.md)
- [Writing notes](docs/guides/writing-notes.md)
- [Plugins](docs/guides/plugins.md)
- [Checks](docs/checks/README.md)
- [Note templates](docs/templates/README.md)

## Repository layout

| Path | Content |
|---|---|
| `packages/` | core packages, published under `@concordance-wiki/*` |
| `plugins/` | official plugins, published under `@concordance-wiki/plugin-*` |
| `presets/` | the `concordance` package, which enables the core and every official plugin |
| `profiles/default.yaml` | the default meta-model |
| `schemas/` | JSON schemas for configuration, profile, model, lock, theme and plugin manifest |
| `fixtures/corpora/` | reference corpora used by the tests, in English and French |
| `docs/` | specification, guides, check pages, note templates |
| `brand/` | logo and brand tokens |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through [SECURITY.md](SECURITY.md).
