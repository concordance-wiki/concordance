# Contributing

Thank you for considering a contribution. This page says how the repository works so that your change gets merged without friction.

## Before you start

- Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
- Open an issue for anything larger than a typo, so that the scope is agreed before the code exists. Bug reports and feature requests have templates; a security issue goes through the [security policy](SECURITY.md), never through a public issue.
- Read the [MVP specification](docs/spec/mvp.md) and the [architecture guide](docs/guides/architecture.md). Every change must fit them; a change that contradicts them starts with a discussion, not a pull request.
- Everything in this repository is in English: code, comments, tests, commits, documentation, fixtures. Labels shown in the generated site go through the i18n catalogue (`en`, `fr`).

## Setting up

```bash
nvm use
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs everything the continuous integration runs. It must pass before every commit. Tests that start an external program (LibreOffice) run only with `CONCORDANCE_INTEGRATION=1`, which the pipeline sets; set it locally when you touch the converter. The tests that assert a wall-clock budget (`packages/lint/test/scale.test.ts`, `packages/inference/test/neighbourhood/load.test.ts`, `packages/nlp/test/scan/performance.test.ts`, `packages/inference/test/duplicates/scale.test.ts`) run in `pnpm test` but not under mutation testing, whose instrumented suite is several times slower (`vitest.stryker.config.mjs`).

| Command | Effect |
|---|---|
| `pnpm build` | compile every package (`tsc -b`) |
| `pnpm test` | every test with coverage; fails under 100% lines, branches, functions and statements |
| `pnpm lint` | ESLint, Prettier, type check of sources and tests, schema and fixture validation, distribution manifests |
| `pnpm build:binary` | the standalone binary of the command line for the current platform, under `dist-bin/` (after `pnpm build`) |
| `pnpm mutation` | Stryker on `core`, `typing`, `nlp`, `inference` and `checks`; fails under 85% |
| `pnpm format` | Prettier on everything it owns (code, configuration, package files) |
| `pnpm licenses:update` | regenerate the [licence inventory](docs/licenses.md) from the installed dependencies; `pnpm licenses:check` verifies that it is current and that every licence is in the allow-list of `scripts/licenses.mjs` |
| `pnpm reference:update` | regenerate the [reference pages](docs/reference/) from the JSON schemas of `packages/core/schemas`; `pnpm lint` fails when a committed page differs from its schema or when a property of those schemas has no `description`, so a schema change is a schema edit, a description, and this command |
| `pnpm walkthrough` | run every command of the [getting-started guide](docs/guides/getting-started.md) on a copy of the golden corpus through the built command line (after `pnpm build`), and check the files they write; under thirty seconds |
| `pnpm measure` | build the golden corpus twice and print the durations and weights as the table of the [operations guide](docs/guides/operations.md), to paste there with its date |
| `pnpm check` | all of the above, plus the determinism step (builds the golden corpus twice with `SOURCE_DATE_EPOCH=0` through the built command line and compares every output file byte for byte), the walkthrough, the hygiene scan and the licence check |

A package lives in `packages/<name>/` with `src/` (compiled to `dist/`), `test/` (Vitest, run against the sources), a `tsconfig.json` for type checking sources and tests (`tsc -b`, so that referenced packages are built first) and a `tsconfig.build.json` for emitting. Every package keeps a test that pins its public exports, so that the public surface changes only on purpose. Under Vitest, `@concordance-wiki/*` imports resolve to the sources of the workspace, so cross-package tests count for coverage and mutation testing without a build.

## Quality bar

- 100% line and branch coverage, always. No coverage ignore without a referenced issue and a justification in review.
- Every branch has a test that verifies a behaviour, not one that merely executes it. Mutation testing runs on `core`, `typing`, `nlp`, `inference` and `checks` with an 85% threshold.
- Strict TypeScript, no `any`, no non-null assertion, no dead code, no `TODO` without an issue.
- Inference and checks are pure functions. Git, file system, network, LibreOffice and the clock are injected interfaces, replaced by doubles in tests.
- Deterministic output: canonical sorting everywhere (`sortCanonically` with the comparators of `core`), no timestamp outside the `build` block of `model.json` and the `at` field of the build log, no random value. Parallel steps sort their results before writing. `SOURCE_DATE_EPOCH` pins the clock; the determinism step relies on it.
- No proper noun anywhere: no person, company, client or real project in code, fixtures, tests or labels. Corpora, templates, examples and gallery samples take Concordance itself as their subject, with pseudonymous participants.
- A new dependency needs a justification in the pull request: function, size, licence compatible with GPL-3.0-or-later, maintenance. Pin the exact version, run `pnpm licenses:update` and commit the regenerated inventory; a licence outside the allow-list of `scripts/licenses.mjs` fails the check, and widening the allow-list is a decision for the maintainers, not a side effect of a pull request.

## Code style

The tooling enforces the style: `tsconfig.base.json`, `eslint.config.js` (strict, type-checked), `.prettierrc`, `.editorconfig`. Beyond that:

- Comment only when the "why" is not obvious. No docstring that repeats the signature. No file header summarising the file.
- Names are explicit English. Check identifiers follow `E-`, `W-` or `I-` plus `AREA-SUBJECT`.
- Documentation is short sentences in the active voice. A README says what the tool does, not how it was made. A key of a schema is documented in the schema itself (`description`), from which `pnpm reference:update` generates the reference pages; the guides explain how the keys work together and link the reference for the tables.

## Commits and branches

- One branch per change: `feat/L1-03-occurrence-scan`, `fix/site-mentions-order`, `docs/getting-started`.
- Conventional Commits, in English, subject of 72 characters or fewer, factual body when it adds something, no emoji.
- Author and committer are your own git identity. No attribution trailer of any kind.
- No direct commit on `main`. No force push.
- Squash fix-up commits before opening the pull request: the history tells a progression, not a struggle.

## Pull requests

The pull request template carries the checklist. In short: tests named after the acceptance criteria, golden corpus snapshot updated and justified or declared unchanged, no coverage exclusion added, no dependency added without justification, labels through i18n, no proper noun, documentation up to date, changeset present.

One pull request does one thing. A pull request that fixes a bug and renames a module is two pull requests. Keep the description factual: what changes, why, and what a reviewer should look at first.

A pull request from a fork runs every blocking test without any secret or private repository.

## Review

- Every pull request needs a green pipeline and one approval from a maintainer before it is merged. A maintainer's own small change (documentation, a dependency bump, a fix under fifty lines with its test) may be merged by its author once the pipeline is green; a story is always reviewed by someone else.
- Expect a first answer within a week. A pull request without activity for a month is closed and can be reopened.
- Reviewers check the acceptance criteria against the tests first, then the documentation, then the code. A comment says whether it blocks the merge or is a suggestion.
- Discussions about the design happen in the issue, before the code; the review is about whether the code delivers what the issue agreed on.
- A pull request is merged as it is, with its history: that is why its commits are squashed into a progression before the review starts.

## The project wiki

The tool documents itself: the demonstration repositories of the organisation (`demo-glossary`, `demo-specs`, built by `demo-wiki`) are its wiki, and continuous integration runs `scripts/parity.mjs` against fresh clones of them. When a pull request adds or renames a check, a page slot, an active type, a top-level configuration key or a public design decision, it comes with the matching note in those repositories, written from the public documentation only, or the parity step fails. Locally, `DEMO_ROOT=<folder holding the three checkouts> pnpm parity` runs the same check; the default is the parent folder of this repository.

## Releases

Versions and the changelog are managed by Changesets. Every pull request that changes a published package adds a changeset (`pnpm changeset`) that names the packages, the bump and one sentence for the changelog. Releases are cut by the maintainers following the [release guide](docs/guides/releasing.md).

## Licence

By contributing you agree that your contribution is licensed under the [GNU General Public License, version 3 or later](LICENSE), like the rest of the project.
