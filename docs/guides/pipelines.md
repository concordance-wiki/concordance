# Pipelines

Every pipeline of this page is complete: copy it into the repository named at its head, commit, and it runs. Two kinds of pipeline exist. The configuration repository builds the wiki and publishes `dist/` on the pages of the forge, on every push and every morning; each knowledge repository lints itself on every merge request and lets the forge show the findings in the diff. `scripts/validate.mjs` checks that every YAML block of this page parses, on every change of the repository.

The examples install the published `concordance` package with npm; the [container image](#with-the-container-image) variants at the end remove the Node.js setup and carry LibreOffice for the day office conversion is wired. Pin a version (`concordance@1.2.0`, `concordancewiki/concordance:1.2.0`) in a pipeline that must not change under your feet. Sources that need credentials are covered by [private repositories](configuration.md#private-repositories) in the configuration guide: the pipeline gives git a token, the configuration never carries one.

## Build and publish

### GitHub Pages

`.github/workflows/wiki.yml` of the configuration repository. Once, in the settings of the repository, set Pages → Source to "GitHub Actions"; nothing else to configure. The examples name the actions by their major tag for legibility; a repository that must stay reproducible pins each action to a commit (`actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`), as the pipelines of the tool itself do. The `build` job writes `dist/` and hands it to the `deploy` job, which needs the `pages` and `id-token` permissions and nothing more.

Every action is pinned by the commit of its release, the tag in a comment, so that a moved tag never runs something else in your pipeline.

```yaml
name: wiki
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 5 * * *" }]
  workflow_dispatch: {}
permissions: { contents: read }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with: { node-version: 22 }
      - uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4
        with: { path: .concordance-cache, key: concordance-cache }
      - run: npm install --global @concordance-wiki/concordance
      - run: concordance build
      - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
```

The site is served under `https://<owner>.github.io/<repository>/`; every link of the site is relative, so the prefix needs no setting. `actions/cache` keeps `.concordance-cache/` between runs: the clones are refreshed rather than redone, and converted documents will be reused once a converter runs.

### GitLab Pages

`.gitlab-ci.yml` of the configuration repository. GitLab publishes the `public/` artifact of the job named `pages`, so the build writes there; the site is served under `https://<group>.gitlab.io/<project>/` without any setting.

```yaml
pages:
  image: node:22
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - npm install --global @concordance-wiki/concordance
    - concordance build --output public
  cache:
    key: concordance-cache
    paths: [.concordance-cache]
  artifacts:
    paths: [public]
```

Add a pipeline schedule in the project (Build → Pipeline schedules) for the morning build; the `rules` above let it through. The cache keeps `.concordance-cache/` between jobs, like the GitHub example.

## Lint in a merge request

Each knowledge repository checks itself on every merge request with `concordance lint`; `--format` gives the forge a report it annotates the diff with, and the step fails according to `--fail-on` (`error` by default). Both examples run the linter at the root of the knowledge repository; pass `--config` and `--source` when the repository is declared in a `concordance.yaml` whose rules must apply (the type suffixes to strip from identifiers, the `checks` overrides), and put a [`concordance-lint.yaml`](configuration.md#concordance-lintyaml) at the root to override severities locally.

### GitHub, SARIF in the diff

`.github/workflows/lint.yml` of the knowledge repository. The SARIF log goes to code scanning: each finding appears in the margin of the diff, on its file and line. `continue-on-error` lets the upload happen before the job fails on the exit code.

```yaml
name: lint
on: { pull_request: {} }
jobs:
  lint:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
      # The configuration of the wiki, so that the typing rules and the profile of this source apply.
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { repository: your-organisation/wiki, path: .wiki }
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with: { node-version: 22 }
      - id: lint
        run: npx --yes @concordance-wiki/concordance lint --source glossary --config .wiki/concordance.yaml --format sarif --output concordance.sarif
        continue-on-error: true
      - uses: github/codeql-action/upload-sarif@faaca9a8f6edddba5725ffe5adefdab6669a2eca # v3
        with: { sarif_file: concordance.sarif }
      - if: steps.lint.outcome == 'failure'
        run: exit 1
```

The GitHub action `concordance-wiki/lint-action` wraps these steps in one line with the version pinned; see [Distributing the linter](lint-distribution.md#github-action).

### GitLab, JUnit in the merge request

`.gitlab-ci.yml` of the knowledge repository. The JUnit report makes the merge request list each finding as a failed test, with its message, its remediation and the URL of its documentation page; `when: always` keeps the report when the job fails.

```yaml
lint:
  image: node:22
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npx --yes @concordance-wiki/concordance lint --format junit --output concordance-junit.xml
  artifacts:
    when: always
    reports:
      junit: concordance-junit.xml
```

The GitLab CI/CD component `concordance-wiki/lint/lint` wraps this job with the version pinned and adds the SARIF log as a second artifact; see [Distributing the linter](lint-distribution.md#gitlab-cicd-component).

## With the container image

The image `concordancewiki/concordance` carries Node.js, the `@concordance-wiki/concordance` preset, git, headless LibreOffice and the fonts the conversion needs; the pipeline only mounts the configuration repository on `/wiki`. The image runs as uid 1000, so the working directory of the job must be writable by that user; the [operations guide](operations.md#container-image) says how to keep `dist/` yours on a runner that checks out as another user.

### GitHub Pages, in the container

```yaml
name: wiki
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 5 * * *" }]
  workflow_dispatch: {}
permissions: { contents: read }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
      - uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4
        with: { path: .concordance-cache, key: concordance-cache }
      - run: docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
      - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
```

### GitLab Pages, in the container

The job runs inside the image itself, whose entry point is the `concordance` command; the checkout of the runner is the working directory, so no mount is needed.

```yaml
pages:
  image:
    name: concordancewiki/concordance
    entrypoint: [""]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - concordance build --output public
  cache:
    key: concordance-cache
    paths: [.concordance-cache]
  artifacts:
    paths: [public]
```

### Lint, in the container

The same image lints a knowledge repository; on GitLab the job's image is the linter:

```yaml
lint:
  image:
    name: concordancewiki/concordance
    entrypoint: [""]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - concordance lint --scope repo --format junit --output concordance-junit.xml
  artifacts:
    when: always
    reports:
      junit: concordance-junit.xml
```

On GitHub, replace the `npx` step of the [SARIF workflow](#github-sarif-in-the-diff) with `docker run --rm -v "$PWD:/wiki" concordancewiki/concordance lint --format sarif --output concordance.sarif`; the upload step is unchanged.
