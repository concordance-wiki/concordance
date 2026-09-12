# Contributing

Thank you for considering a contribution. This page says how the repository works so that your change gets merged without friction.

## Before you start

- Open an issue for anything larger than a typo, so that the scope is agreed before the code exists.
- Read the [MVP specification](docs/spec/mvp.md) and the [architecture guide](docs/guides/architecture.md). Every change must fit them; a change that contradicts them starts with a discussion, not a pull request.
- Everything in this repository is in English: code, comments, tests, commits, documentation, fixtures. Labels shown in the generated site go through the i18n catalogue (`en`, `fr`).

## Setting up

```bash
nvm use
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs everything the continuous integration runs. It must pass before every commit. Tests that start an external program (LibreOffice) run only with `CONCORDANCE_INTEGRATION=1`, which the pipeline sets; set it locally when you touch the converter.

| Command | Effect |
|---|---|
| `pnpm build` | compile every package (`tsc -b`) |
| `pnpm test` | every test with coverage; fails under 100% lines, branches, functions and statements |
| `pnpm lint` | ESLint, Prettier, type check of sources and tests, schema and fixture validation |
| `pnpm mutation` | Stryker on `core`, `typing`, `nlp`, `inference` and `checks`; fails under 85% |
| `pnpm format` | Prettier on everything it owns (code, configuration, package files) |
| `pnpm check` | all of the above, plus the determinism step (builds the golden corpus twice with `SOURCE_DATE_EPOCH=0` through the built command line and compares every output file byte for byte) and the hygiene scan |

A package lives in `packages/<name>/` with `src/` (compiled to `dist/`), `test/` (Vitest, run against the sources), a `tsconfig.json` for type checking sources and tests (`tsc -b`, so that referenced packages are built first) and a `tsconfig.build.json` for emitting. Every package keeps a test that pins its public exports, so that the public surface changes only on purpose. Under Vitest, `@concordance-wiki/*` imports resolve to the sources of the workspace, so cross-package tests count for coverage and mutation testing without a build.

## Quality bar

- 100% line and branch coverage, always. No coverage ignore without a referenced issue and a justification in review.
- Every branch has a test that verifies a behaviour, not one that merely executes it. Mutation testing runs on `core`, `typing`, `nlp`, `inference` and `checks` with an 85% threshold.
- Strict TypeScript, no `any`, no non-null assertion, no dead code, no `TODO` without an issue.
- Inference and checks are pure functions. Git, file system, network, LibreOffice and the clock are injected interfaces, replaced by doubles in tests.
- Deterministic output: canonical sorting everywhere (`sortCanonically` with the comparators of `core`), no timestamp outside the `build` block of `model.json` and the `at` field of the build log, no random value. Parallel steps sort their results before writing. `SOURCE_DATE_EPOCH` pins the clock; the determinism step relies on it.
- No proper noun anywhere: no person, company, client or real project in code, fixtures, tests or labels. The fictional corpus is a generic personal insurer with invented names.
- A new dependency needs a justification in the pull request: function, size, licence compatible with GPL-3.0-or-later, maintenance.

## Code style

The tooling enforces the style: `tsconfig.base.json`, `eslint.config.js` (strict, type-checked), `.prettierrc`, `.editorconfig`. Beyond that:

- Comment only when the "why" is not obvious. No docstring that repeats the signature. No file header summarising the file.
- Names are explicit English. Check identifiers follow `E-`, `W-` or `I-` plus `AREA-SUBJECT`.
- Documentation is short sentences in the active voice. A README says what the tool does, not how it was made.

## Commits and branches

- One branch per change: `feat/L1-03-occurrence-scan`, `fix/site-mentions-order`, `docs/getting-started`.
- Conventional Commits, in English, subject of 72 characters or fewer, factual body when it adds something, no emoji.
- Author and committer are your own git identity. No attribution trailer of any kind.
- No direct commit on `main`. No force push.
- Squash fix-up commits before opening the pull request: the history tells a progression, not a struggle.

## Pull requests

The pull request template carries the checklist. In short: tests named after the acceptance criteria, golden corpus snapshot updated and justified or declared unchanged, no coverage exclusion added, no dependency added without justification, labels through i18n, no proper noun, documentation up to date, changeset present.

A pull request from a fork runs every blocking test without any secret or private repository.

## Releases

Versions and the changelog are managed by Changesets. Every pull request that changes a published package adds a changeset (`pnpm changeset`). Releases are cut by the maintainers following the [releasing guide](docs/guides/releasing.md).

## Licence

By contributing you agree that your contribution is licensed under the [GNU General Public License, version 3 or later](LICENSE), like the rest of the project.
