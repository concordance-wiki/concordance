# Documentation

Everything a reader, an integrator or a contributor needs, in English, next to the code it describes. The guides are prose, the reference is generated from the schemas, the check pages are one per finding identifier, the specification is the contract the implementation honours.

## Guides

| Page | For whom | What it answers |
|---|---|---|
| [Getting started](guides/getting-started.md) | integrator | from nothing to a published wiki in seven steps, under thirty minutes on the golden corpus |
| [Writing notes](guides/writing-notes.md) | author | what a note is, what frontmatter adds, which sections mean something, how a relation gets its name |
| [Configuration](guides/configuration.md) | integrator | how the keys of `concordance.yaml`, `theme.yaml`, `profile.yaml` and `concordance-lint.yaml` work together, with examples |
| [The command line](guides/command-line.md) | integrator | what `init`, `validate-config`, `build`, `render`, `export`, `lint` and `gallery` read, write and return |
| [Pipelines](guides/pipelines.md) | integrator | build and publish on GitHub Pages and GitLab Pages, lint in a merge request, with or without the container image; copyable |
| [Operations](guides/operations.md) | maintainer of a wiki | build time and weight to expect, what `dist/` and the cache hold, the container image, reproducible builds, exit codes, the human steps |
| [What the tool does not do](guides/limits.md) | everyone | the limits by design and the state of this version, one line each |
| [Publishing transcripts](guides/publishing-transcripts.md) | compliance owner | what pseudonymisation does, what it cannot decide, what to settle before publishing |
| [Theming](guides/theming.md) | theme author | the slots of the site, their view models, white label, overriding a slot from a plugin, the stylesheet layers, the gallery |
| [Accessibility](guides/accessibility.md) | theme author | what is verified on every page of the gallery, criterion by criterion, the test that enforces it, what a theme author must keep |
| [Plugins](guides/plugins.md) | plugin author | the official plugins, declaring one, the contribution points |
| [Adding a type](guides/adding-a-type.md) | architect | the type module format, a complete example, how the core types are assembled, publishing a type in a plugin |
| [Distributing the linter](guides/lint-distribution.md) | integrator | `npx`, standalone binary, GitHub action, GitLab component, container image, pre-commit hook |
| [Architecture](guides/architecture.md) | contributor | the decisions that shape the tool and the build pipeline step by step |
| [Releasing](guides/releasing.md) | maintainer | versions and their contract, changesets, the version pull request, the tag and the release, the container image |

## Reference

Generated from the JSON schemas of [`packages/core/schemas`](../packages/core/schemas/) by `pnpm reference:update`; a committed page that differs from its schema fails `pnpm lint`.

| Page | File it describes |
|---|---|
| [Configuration reference](reference/configuration.md) | `concordance.yaml` |
| [Lint configuration reference](reference/lint.md) | `concordance-lint.yaml` |
| [Theme reference](reference/theme.md) | `theme.yaml` |
| [Profile reference](reference/profile.md) | `profile.yaml` and the default profile |
| [Lock file reference](reference/lock.md) | `concordance.lock.yaml` |
| [Type module reference](reference/type-module.md) | `type.yaml` of a type module |

## Checks

[One page per check identifier](checks/README.md): what the finding means, the situation before and after the fix. Every finding line of the build and of the linter ends with the URL of its page.

## Templates

[One note template per type](templates/README.md), shipped with `concordance init --templates`.

## Specification

- [MVP specification](spec/mvp.md): scope, architecture, meta-model, pipeline, every story with its acceptance criteria, exit criteria.
- [Requirements](spec/requirements.md): vision, personas, principles, the meta-model in full, what comes after the MVP.

## Also

- [Licence inventory](licenses.md): every third-party dependency and its licence.
- [Organisation site](site/README.md): the hand-written home page of the project.
