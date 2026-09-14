# Distributing the linter

`concordance lint` reaches a knowledge repository in six forms. They all run the same command line, `@concordance-wiki/cli`, with the same check registry, and produce the same report on the same repository; the repository verifies it on every change that touches the linter (see [Same output everywhere](#same-output-everywhere)). Pick the form that fits the place where the check runs.

| Form | Where | Needs |
|---|---|---|
| [`npx` package](#npx-package) | any shell, any pipeline | Node.js 22 |
| [Standalone binary](#standalone-binary) | machines without Node.js | nothing |
| [GitHub action](#github-action) | pull requests on GitHub | nothing |
| [GitLab CI/CD component](#gitlab-cicd-component) | merge requests on GitLab | nothing |
| [Container image](#container-image) | any runner with a container engine | Docker or Podman |
| [pre-commit hook](#pre-commit-hook) | every commit, on the author's machine | Python and pre-commit |

Every form takes the options of [`concordance lint`](command-line.md#lint): `--scope`, `--source`, `--config`, `--fail-on`, `--format`, `--output`. Every form honours a [`concordance-lint.yaml`](configuration.md#concordance-lintyaml) at the root of the repository, which keeps the files that are not notes out of the checks (`exclude`), overrides severities locally and names the published model for `--scope global`, leaves out the files git ignores unless `--no-gitignore` is given, and exits with 0 when no finding reaches the `--fail-on` severity, 1 when one does, 2 when the lint could not run. The examples below use `--scope repo`, which needs no network; `--scope global` works the same way in every form once the pipeline can reach the model, and falls back to the local checks when it cannot.

Pin one version and use it in every form: the version of `@concordance-wiki/cli` is the version of the registry of checks. The action, the component and the hook default to the version they were released with.

## `npx` package

The package `@concordance-wiki/cli` ships the `concordance` executable (`conc` as a short alias) and its production dependencies; `npx` fetches it once and caches it. It is published to npm by the `release` workflow from the tarball attached to the release of the same version, once the maintainer has enabled that publication ([Releasing](releasing.md#publish)); a version on npm, the tag `v<version>`, the action, the component, the hook and the image of that version all name the same commit.

```bash
npx --yes @concordance-wiki/cli@0.1.0 lint --scope repo --fail-on warning
```

Without a version, `npx` takes the latest. In a repository with its own `package.json`, install it once and let the scripts call it:

```bash
npm install --save-dev @concordance-wiki/cli@0.1.0
```

```json
{
  "scripts": {
    "lint": "concordance lint --scope repo --fail-on warning"
  }
}
```

The repository's own test installs the package the way npm does: it deploys the built package with its dependencies, installs it into an empty project without any registry, and runs `npx concordance lint` on the faulty corpus.

## Standalone binary

One file per platform, `concordance-<platform>-<arch>` (`concordance-linux-x64`, `concordance-darwin-arm64`, `concordance-win32-x64.exe`), with its SHA-256 next to it, attached to each release of the repository, with the tarball of every package and `checksums.txt`. It embeds Node.js and the command line, so nothing needs to be installed.

```bash
curl -fsSLO https://github.com/concordance-wiki/concordance/releases/download/v0.1.0/concordance-linux-x64
curl -fsSLO https://github.com/concordance-wiki/concordance/releases/download/v0.1.0/concordance-linux-x64.sha256
sha256sum --check concordance-linux-x64.sha256
chmod +x concordance-linux-x64
./concordance-linux-x64 lint --scope repo --fail-on warning
```

The binary is a Node.js single executable application. On its first run it unpacks the command line and its dependencies into `$XDG_CACHE_HOME/concordance/runtime/<version>-<digest>` (`~/.cache/concordance/runtime` by default; `CONCORDANCE_RUNTIME_DIR` overrides the folder), and every run after that starts from there. The lint itself still writes nothing but the report named by `--output`.

Build it from a checkout of the repository, on the platform it is for:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm build:binary
./dist-bin/concordance-linux-x64 lint --scope repo
```

`scripts/build-binary.mjs` deploys the built command line with its production dependencies (`pnpm deploy`), packs the tree into one compressed asset, generates the single executable blob with `node --experimental-sea-config` and injects it with the loader `scripts/sea-loader.cjs` into a copy of the running Node.js executable, through `postject`. `--output <dir>` picks the folder, `--node <path>` the Node.js executable to embed. The workflow builds the Linux binary on every change to the linter and keeps it as the `concordance-linux-x64` artifact of the run.

## GitHub action

The action installs Node.js, runs the pinned version of the linter and uploads the SARIF report to code scanning: each finding then appears in the margin of the diff, on its file and line, and the step fails according to `fail-on`. It is published from the `concordance-wiki/lint-action` repository, whose tags follow the versions of `@concordance-wiki/cli`; its source is [`distribution/github-action`](../../distribution/github-action/README.md) in this repository.

```yaml
name: lint
on: { pull_request: {} }
jobs:
  lint:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
      - uses: concordance-wiki/lint-action@v0.1.0
        with:
          fail-on: warning
```

Inputs, all optional:

| Input | Default | Effect |
|---|---|---|
| `version` | the version the action was released with | version of `@concordance-wiki/cli` to run |
| `fail-on` | `error` | severity from which a finding fails the step |
| `source` | none | `--source`: the name of the source this repository is declared as |
| `config` | none | `--config`: the `concordance.yaml` that declares the source, relative to the working directory |
| `working-directory` | `.` | root of the knowledge repository |
| `format` | `sarif` | `--format`; only a SARIF report is uploaded to code scanning |
| `output` | `concordance.sarif` | `--output`, relative to the working directory |
| `upload` | `true` | `false` keeps the report as a file without uploading it; the `security-events` permission is then not needed |
| `node-version` | `22` | Node.js version installed for the run |
| `command` | none | runs this command instead of `npx --yes @concordance-wiki/cli@<version>`; for an unpublished build |

Outputs: `report`, the absolute path of the report, and `exit-code`, 0 or 1. The report is uploaded before the step fails, so that the findings reach the diff even when they block the merge.

## GitLab CI/CD component

The component adds one `concordance-lint` job that runs the pinned version of the linter and publishes two artifacts: the JUnit report, which the merge request lists as failed tests with the message, the remediation and the documentation URL of each finding, and the SARIF log, for the tools that read it. It is published from the `concordance-wiki/lint` project of the `concordance-wiki` group on GitLab, whose releases follow the versions of `@concordance-wiki/cli`; its source is [`distribution/gitlab-component`](../../distribution/gitlab-component/README.md) in this repository.

```yaml
include:
  - component: $CI_SERVER_FQDN/concordance-wiki/lint/lint@0.1.0
    inputs:
      fail_on: warning
```

Inputs, all optional:

| Input | Default | Effect |
|---|---|---|
| `version` | the version the component was released with | version of `@concordance-wiki/cli` to run |
| `fail_on` | `error` | severity from which a finding fails the job: `error`, `warning` or `info` |
| `source` | none | `--source`: the name of the source this repository is declared as |
| `config` | none | `--config`: the `concordance.yaml` that declares the source, relative to the repository root |
| `stage` | `test` | stage of the job |
| `image` | `node:22` | image of the job; any image with Node.js 22 and npm |

The job writes `concordance-junit.xml` and `concordance.sarif` at the root of the repository and keeps both as artifacts whether it passes or fails.

## Container image

The image `concordancewiki/concordance` runs the same command line without Node.js on the host; mount the repository on `/wiki`. Its tags follow the versions of `@concordance-wiki/cli`.

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance:0.1.0 lint --scope repo --fail-on warning
```

In a pipeline, the image is the job's image and the checkout is the working directory:

```yaml
lint:
  image: concordancewiki/concordance:0.1.0
  script:
    - concordance lint --scope repo --format junit --output concordance-junit.xml
  artifacts:
    when: always
    reports:
      junit: concordance-junit.xml
```

## pre-commit hook

The hook runs `concordance lint --scope repo` on the whole repository before each commit that touches a markdown or YAML file; pre-commit installs the pinned version of the linter in its own environment. The hook is declared in [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) at the root of this repository, so `repo:` names it and `rev:` picks the release, a tag of the form `v<version>`:

```yaml
repos:
  - repo: https://github.com/concordance-wiki/concordance
    rev: "v0.1.0"
    hooks:
      - id: concordance-lint
```

Arguments go through `args`; `additional_dependencies` runs another version of the linter than the one `rev` pins:

```yaml
      - id: concordance-lint
        args: [--fail-on, warning, --source, glossary, --config, ../concordance.yaml]
        additional_dependencies: ["@concordance-wiki/cli@0.1.1"]
```

pre-commit installs the hook once per `rev`, with the development dependencies of this repository; the `repo: local` form of pre-commit avoids that checkout and installs the linter alone:

```yaml
repos:
  - repo: local
    hooks:
      - id: concordance-lint
        name: concordance lint
        entry: concordance lint --scope repo
        language: node
        additional_dependencies: ["@concordance-wiki/cli@0.1.0"]
        pass_filenames: false
        types_or: [markdown, yaml]
```

The hook exits like the command: the commit is refused when a finding reaches the `--fail-on` severity.

## Same output everywhere

The forms are tied to one version of `@concordance-wiki/cli` and checked against each other:

- `scripts/check-distribution.mjs`, run by `pnpm lint`, verifies that the action, the component and the hook expose the documented inputs, produce the documented reports, and pin the version of `packages/cli`. The version pull request rewrites the three pins with `node scripts/sync-distribution-versions.mjs` ([Releasing](releasing.md)); `node scripts/check-distribution.mjs --write` does the same by hand.
- The `lint-distribution` workflow runs on every pull request that touches `packages/cli`, `packages/lint`, `packages/checks` or `distribution`, and on every release tag. It lints the `notes` source of the faulty corpus through the built command line, the `npx` package installed without any registry, the standalone binary built on the runner and the action taken from its source folder, then compares the four JSON reports byte for byte once `tool.version` is normalised (`scripts/compare-distribution.mjs`). The container image joins the comparison once its workflow publishes it. The GitLab component and the pre-commit hook, which no GitHub runner executes, are validated structurally in the same workflow, the hook manifest with `pre-commit validate-manifest`.
- `packages/cli/test/npx.test.ts` installs the package as npm does and runs `npx concordance lint` on the faulty corpus, comparing its report with the in-process command.
