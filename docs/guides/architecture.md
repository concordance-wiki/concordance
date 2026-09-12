# Architecture

This page states the decisions that shape Concordance. Each one is a constraint on any change; a change that needs to break one starts with a discussion.

## Standard markdown only

Concordance reads CommonMark, GFM (tables, task lists) and optional YAML frontmatter. Links are relative markdown links. There is no wikilink, no proprietary tag, no directive. Every file in a knowledge repository stays fully readable without the tool. Structured information goes through frontmatter, section headings and lists, never through new syntax.

## Static generation in a pipeline

`concordance build` is a pipeline command that produces `dist/` and `model.json`. The site is static: the main content of every page is in the served HTML, JavaScript is progressive, and the site works over `file://`. Fragments that load on demand (mentions beyond the first twenty, search) are JSON files generated at build. An optional HTTP and MCP service will consume the same `model.json` later; nothing in the site depends on it.

## Declarative profile, generic engine

The meta-model is a YAML profile validated by a schema: types, attributes, relations with their allowed pairs, mapped sections, confidence scale, display rules. The engine only knows "type, attributes, relations, score". Adding a type, an attribute or a relation pair is a profile change, never a code change, and a test enforces it. Relation labels shown in the site come from the profile.

## Confidence and provenance on every link

Every link carries a confidence in [0, 1] and at least one provenance (method, file, line, context). When several methods produce the same source-target-relation triple, the confidence becomes `1 − Π(1 − cᵢ)`, capped at 1, and every provenance is kept. The scale per method lives in the profile. In the first version the score orders mentions and decides what is displayed; it is stored, not shown.

## Preview through PDF conversion at build

Office documents are converted to PDF by headless LibreOffice, rendered by pdf.js, with PNG thumbnails per slide. The cache is addressed by the SHA-256 of the source file and lives in the pipeline cache, not in the published artefact. Text is extracted from the converted PDF, the single extraction path. An unconvertible document stays an entity with its metadata, a download link and a finding.

## Lock file for human decisions

`concordance.lock.yaml`, in the configuration repository, records accepted and rejected links, merged and separated duplicates, and rejected term candidates. The first version reads `rejected_terms` only; the other keys are accepted by the schema and ignored with a warning. Nothing is ever written into a knowledge repository.

## TypeScript monorepo

Strict TypeScript, ESM, Node LTS from `.nvmrc`, pnpm workspaces, packages published under `@concordance-wiki/*`, versions and changelog through Changesets.

## No database

The graph is built in memory and serialised to `model.json`, canonically sorted and schema-validated. `concordance render` reads it without touching the sources. A Cypher export is provided for those who want the graph elsewhere.

## Deterministic identifiers

An entity's identifier is `<source>/<relative path without extension or type suffix>`, slugified. A frontmatter `id` takes precedence. Never a UUID, never anything that depends on processing order. Duplicates yield `E-ID-DUP`; the first in canonical order is kept. The identifier is the page URL.

## Findings, not failures

A content anomaly becomes a finding: identifier, severity, file, line, message, remediation. Findings go to `dist/build.log.json` and `model.json`. The build fails only according to `build.fail_on`. Every check is a pure function `(model) → findings[]` in a registry shared by the build and the linter; a test enforces parity.

## Bounded neighbourhood

Co-occurrence is accumulated per paragraph, never as a full matrix. Only the K best neighbours of each node are kept (50 by default, `inference.neighbours.k`), ranked by count then by identifier.

## Keyword page threshold

A keyword page exists from three occurrences in at least two files (`inference.keyword_pages`). Below the threshold the word is searchable but has no page. The build summary reports pages generated and expressions discarded.

## Paginated mentions

The first twenty mentions are in the served HTML; the rest loads from a JSON fragment per entity. Never a global index. A page weighs under 150 KB excluding previews.

## Core, plugins, preset

The core packages read markdown and produce JSON. They depend on no office format and no system tool. Format readers, the LibreOffice converter, contract importers, viewers and heavy projections are plugins under `@concordance-wiki/plugin-*`, declared in `concordance.yaml` under `plugins:`, contributing through a versioned plugin API (reader, converter, source, inference method, check, projection, UI component). A plugin whose system dependency is missing disables itself with a finding. The unscoped `concordance` package is the preset that enables the core and every official plugin; it is what the documentation installs.

## Locale per source

Each source declares `locale: en | fr`, defaulting to the project locale. The locale selects a language pack: normalisation, plural rules, default stopwords, type prefixes and collation. The `en` and `fr` packs are in the core, in `@concordance-wiki/nlp`; other languages are plugins that register their pack in the language pack registry (`registerLanguagePack`), and a locale no pack serves is a configuration error. Every ingested source carries its resolved locale, which the entities built from it inherit.

## Search

The index is generated at build by Pagefind, fragmented by prefix and loaded on demand. Facets are metadata with counts frozen at build. No typo tolerance beyond the prefix, no semantic search: those belong to the service.

## Diagrams

Static diagrams are rendered at build (Mermaid to SVG). Later, BPMN and the global graph render client-side, loaded on demand. Every graphical view has a textual equivalent in the HTML.
