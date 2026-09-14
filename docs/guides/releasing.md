# Releasing

This page is the contract between the version number and what it promises. The versions are held by the pipeline: every merge on `main` that carries a changeset feeds one version pull request, merging that pull request tags the commit and publishes the GitHub release with its changelog and its assets. No step depends on anyone's memory, and the one decision that stays human is the merge.

## What a release contains

A release publishes, under one version number:

- a git tag `v<major>.<minor>.<patch>` on `main`, annotated;
- a GitHub release on that tag whose notes are the changelog entries of the version, with as assets the standalone binaries of the linter (`concordance-linux-x64`, `concordance-darwin-arm64`, `concordance-win32-x64.exe`, each with its SHA-256 next to it), the tarball of every published package as `pnpm pack` writes it, `checksums.txt` with the SHA-256 of every asset, and `licenses.md`, the [licence inventory](../licenses.md) verified on the released commit;
- the `CHANGELOG.md` of every package, next to it, written by Changesets;
- the container image `concordancewiki/concordance`, built and tested by the `image` workflow on the tag; its publication to Docker Hub stays disabled until the maintainer of the account enables it ([Container image](#container-image));
- the packages `@concordance-wiki/*` and the `concordance` preset on npm, the same tarballs as the release assets, once the maintainer enables the `publish` job ([Publish](#publish)); until then they are versioned, packed and attached to the release, not pushed to a registry.

Every form of the tool at one version names one commit: the npm version, the git tag, the container image, the GitHub action, the GitLab component and the pre-commit hook of `v<x.y.z>` all come from the merge commit of the version pull request, and the tarballs published to npm are the bytes attached to the release, verified by their checksums.

Every package is published under the [GNU General Public License, version 3 or later](../../LICENSE).

## Versions

Versions follow [Semantic Versioning](https://semver.org/). Before `1.0.0`, a minor version may break compatibility and says so in its changelog entry; a patch version never does. The first version is `0.1.0`, set by the first version pull request from the changesets accumulated since the start.

The packages of the workspace share one version number: a release bumps every published package, even one that did not change, so that `@concordance-wiki/*` packages and the `concordance` preset of one version always work together. This is the `fixed` group of `.changeset/config.json`.

The contract that a version commits to:

- the configuration schema (`concordance.yaml`) and the `model.json` schema, both published by `@concordance-wiki/core`;
- the command line (`build`, `export`, `init`, `validate-config`, `lint`, `gallery`) and its exit codes;
- the plugin API of `@concordance-wiki/core`;
- the default profile.

A breaking change to any of those is a major version once `1.0.0` is reached, and a minor version that says so before.

## Changesets

Every pull request that changes a published package adds a changeset file under `.changeset/`, written with `pnpm changeset`: the packages it touches, the bump (`patch`, `minor`, `major`) and one sentence for the changelog, in English, in the active voice, from the user's point of view ("Reads VTT transcripts with addressable timecodes", not "Added VTT support"). A change that touches no published package (documentation, scripts, fixtures, workflows) adds none.

The pipeline enforces it: the `check` job of every pull request runs `pnpm changeset status --since origin/main` and fails when a file under `packages/*`, `plugins/*` or `presets/*` changed without a changeset added by the same pull request. The label `no-changeset` lifts the check, for a pull request that touches a package without changing what it publishes (its tests, its typings, a comment); the reason is written in the pull request. Adding or removing the label runs the pipeline again.

The changelog of each package (`CHANGELOG.md`) is generated from the changesets: nobody edits it by hand. A changelog entry that a user would not understand is rewritten in the changeset before the version pull request is merged, and the pull request refreshes itself.

## What the machine does

1. **The version pull request.** On every push to `main`, the `release-pr` workflow reads the pending changesets. When there are some, it opens or refreshes the pull request `chore(release): v<x.y.z>` from the branch `changeset-release/main` by running `pnpm release:version`: `changeset version` bumps the versions, writes the changelogs and deletes the consumed changesets; `pnpm install --lockfile-only` refreshes the lockfile; `node scripts/sync-distribution-versions.mjs` pins the GitHub action, the GitLab component and the pre-commit hook to the new version, and `scripts/check-distribution.mjs` verifies the pins as part of `pnpm lint`. The version is the one of `@concordance-wiki/cli` in the release plan; every published package takes it. The pull request is never merged automatically.
2. **The tag and the release.** The `release` workflow runs on every push to `main` that changes `packages/cli/package.json`. When the version differs from the one before the push, it creates the annotated tag `v<x.y.z>` on that commit and pushes it, builds the standalone binary on Linux x64, macOS arm64 and Windows x64 with `scripts/build-binary.mjs`, packs every published package with `pnpm pack` into `dist-release/`, verifies the licence inventory (`pnpm licenses:check`) and copies it there, writes `checksums.txt`, gathers the release notes from the changelogs (`scripts/release-notes.mjs <version>`: every entry of the version once, whatever the number of packages that carry it, by bump, then the packages at that version) and creates the GitHub release with `gh release create`, `--prerelease` when the version carries a prerelease suffix. It then dispatches the `image` workflow on the tag, since a tag pushed with the workflow token triggers no workflow by itself.
3. **The container image.** The `image` workflow builds and tests the image on the tag; its `publish` job stays disabled ([Container image](#container-image)).
4. **The npm publication.** The `publish` job of the `release` workflow, disabled until the maintainer enables it, publishes the tarballs of the release to npm, checks the published command line against the binary of the release, and its `notes` and `mirrors` jobs complete the release notes and the mirror repositories ([Publish](#publish)).

A pull request that lands on `main` while a version pull request is open refreshes it: the versions and the changelogs of the pull request always reflect every changeset merged so far.

## What stays human

- **Merging the version pull request** is the decision to release. The maintainer reads the diff: the versions, the changelogs from the user's point of view, the lockfile, the distribution pins. A changelog entry that reads badly is fixed in its changeset on `main`, never in the pull request; the pull request refreshes itself.
- **Running the pipeline on the version pull request.** A pull request opened with the workflow token triggers no workflow. Either the maintainer closes and reopens it, which runs the pipeline as for any pull request, or the repository carries the secret `RELEASE_TOKEN`, a fine-grained token with write access to contents and pull requests, which the `release-pr` workflow uses when present so that the pipeline runs on the pull request as soon as it is opened.
- **Allowing the pipeline to open pull requests**: in the repository settings, Actions → General, "Allow GitHub Actions to create and approve pull requests" is enabled once.
- **The Docker Hub publication** of the image, as [Container image](#container-image) describes.
- **The npm publication** of the packages and the mirrors of the action and the component, as [Publish](#publish) describes: the organisation, the trusted publishing or the token, the mirror repositories and their tokens, and the line that enables the job are each a decision of the maintainer.

## Fallback: cutting a release by hand

When the pipeline cannot run, a maintainer does what it does, in the same order, from a clean `main` that passed the full pipeline, on a machine with the Node.js version of `.nvmrc`:

1. `pnpm check` must pass, including the licence inventory (`pnpm licenses:check`).
2. `pnpm release:version` (`changeset version`, `pnpm install --lockfile-only`, `scripts/sync-distribution-versions.mjs`). Read the resulting diff.
3. Open a pull request titled `chore(release): v<x.y.z>` with that diff, and merge it once the pipeline is green. The `release` workflow takes over from the merge: a change of the version on `main` is a release, whoever made it.
4. Only when the `release` workflow cannot run either: tag the merge commit, `git tag -a v<x.y.z> -m "v<x.y.z>"`, push the tag, then from the tagged commit run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm build:binary` on each platform, `pnpm -r --filter './packages/**' --filter './plugins/**' --filter './presets/**' pack --pack-destination dist-release`, `sha256sum` over the assets into `checksums.txt`, `node scripts/release-notes.mjs <version> > notes.md`, and `gh release create v<x.y.z> --verify-tag --notes-file notes.md dist-release/*`.
5. Only when the `publish` job cannot run either: publish the tarballs of the release, never the packages from the workspace, so that what reaches npm is what the release carries — `npm publish dist-release/<tarball> --access public` for each, dependencies first (`pnpm -r --workspace-concurrency=1 --filter './packages/**' --filter './plugins/**' --filter './presets/**' exec pwd` prints that order). `pnpm pack` rewrites the `workspace:*` pins to the version of the release; `npm publish` run inside a workspace package does not, and ships a manifest npm cannot install — which is what happened to 0.1.0, deprecated for that reason.

## Container image

The `image` workflow runs on every tag `v*` (and on pull requests that touch the image inputs, without publishing). It builds `concordancewiki/concordance` from the `Dockerfile` at the root of the repository with the version of the tag, checks that the image runs unprivileged as uid 1000 with the `concordance` entry point, LibreOffice, git and the fonts, builds the golden corpus once inside the container and once outside with the same `SOURCE_DATE_EPOCH`, compares the two output trees byte for byte with `scripts/compare-builds.mjs`, verifies that the container writes nothing but `dist/` and the cache, and measures the image with `docker image inspect`.

The image size is written to the summary of the run under "Container image"; copy it into the release notes so that integrators see the weight of what they pull. The `publish` job pushes the image tested above under `concordancewiki/concordance:<version>` and `:latest`; it is disabled in the workflow until the first release. Enabling it takes three steps by the maintainer of the Docker Hub account: create the repository, add the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets (a read-write access token, not the account password), and replace the `if: false` of the job with `startsWith(github.ref, 'refs/tags/v')`.

## Publish

The `publish` job of the `release` workflow runs after the GitHub release, on the tagged commit, and ships disabled: its `if: false` is the line the maintainer replaces with `needs.version.outputs.version != ''` at the first publication (the workflow runs on `main`, never on the tag, so a condition on `refs/tags/` would keep it silent). Enabled, it does this:

1. checks out the tag `v<x.y.z>` and fails unless `packages/cli/package.json` carries that version;
2. downloads the tarballs, `checksums.txt` and the Linux binary from the release and verifies the tarballs against the checksums, so that what reaches npm is what the release carries, byte for byte; nothing is rebuilt;
3. publishes every tarball with `npm publish <tarball> --provenance --access public`, in dependency order (`pnpm --recursive exec`, dependencies first), under the dist-tag `latest` for a plain version, `rc` for a version with an `-rc` suffix and `next` for any other prerelease; the provenance links each package to the run that published it, which needs the `id-token: write` permission the job carries;
4. smoke-tests the publication the way the `lint-distribution` workflow tests the forms of the linter: from an empty folder, `npx --yes @concordance-wiki/cli@<x.y.z> lint --scope repo --fail-on warning` on the `notes` source of the faulty corpus, once the registry serves the version (up to five minutes), and the same lint through the binary of the release; the two JSON reports must match up to `tool.version` (`scripts/compare-distribution.mjs`).

The `notes` job then appends to the release notes the npm page of every package at the version and the digest of the container image, read from the registry when the `image` workflow has published it already, with a sentence saying it is not there otherwise. The `mirrors` job pushes `distribution/github-action` to the `concordance-wiki/lint-action` repository, tagged `v<x.y.z>` with the major tag `v<x>` moved to it (a prerelease leaves the major tag alone), and `distribution/gitlab-component` to the `concordance-wiki/lint` project on GitLab, tagged and released as `<x.y.z>` for the CI/CD catalog; each only when its token is a secret of the repository, and a missing token is a notice in the run, never an error. The pre-commit hook needs no mirror: `rev: v<x.y.z>` points at this repository. Neither job creates a repository or a project.

To run the smoke test by hand on a published version, from an empty folder with the faulty corpus copied next to it:

```bash
cp -r fixtures/corpora/faulty/en repo && cd repo/notes
npx --yes @concordance-wiki/cli@<x.y.z> lint --scope repo --fail-on warning --config ../concordance.yaml --source notes --format json --output ../../npx.json
../../concordance-linux-x64 lint --scope repo --fail-on warning --config ../concordance.yaml --source notes --format json --output ../../binary.json
node scripts/compare-distribution.mjs npx.json binary.json
```

Both commands exit with 1, the corpus being faulty on purpose, and the comparison prints that the reports are identical.

What a published package contains is checked on every change by `pnpm lint` (`scripts/check-packaging.mjs`, through `scripts/validate.mjs`): the manifest of every workspace package that is not private carries `repository` with its `directory`, `homepage`, `bugs`, `engines.node` and `publishConfig.access: public`, lists in `files` only `dist` or `bin`, the data it reads at run time (the schemas of `@concordance-wiki/core`, the templates of the command line, the language packs, the type modules, the assets of the site), its `README.md` and its `LICENSE`, a copy of the licence of the repository verified byte for byte; every entry point of `exports` and `bin` is under `dist` or `bin`; and the tarball `pnpm pack --dry-run` would write holds neither sources, nor tests, nor fixtures, nor build files. `pnpm pack` rewrites the `workspace:*` pins to the version of the release, so that the packages of one version depend on each other exactly.

Before the first publication, the maintainer of the npm account does this, once, in this order:

1. creates the npm organisation `concordance-wiki`, which holds the scope of the eighteen `@concordance-wiki/*` packages, the preset included: the unscoped name `concordance` belongs to another package on npm, so the preset is published as `@concordance-wiki/concordance` (the getting-started guide, the pipelines guide and the container image name it that way);
2. sets the publication credentials: either trusted publishing, configured on npm for every package with this repository, the workflow file `release.yml` and no environment, which is what `--provenance` and the `id-token: write` permission are for, and needs no secret; or, failing that, an automation token of the organisation, granular, with publish access to the packages, stored as the `NPM_TOKEN` secret of the repository, which the job writes to the npm configuration when it is set;
3. creates the `concordance-wiki/lint-action` repository on GitHub and the `concordance-wiki/lint` project of the `concordance-wiki` group on GitLab, both empty, and stores a token with write access to each as the `LINT_ACTION_TOKEN` and `GITLAB_LINT_TOKEN` secrets; without a secret the matching mirror is skipped with a notice;
4. replaces the `if: false` of the `publish` job with `needs.version.outputs.version != ''`.

A version released before the job was enabled stays on GitHub only: the job publishes the versions that follow it, and never an earlier one, which npm would refuse anyway since a version is published once.

## Support

- The latest minor version receives fixes. Older versions receive none: upgrading is the fix.
- Security fixes follow the [security policy](../../SECURITY.md).
- Node.js: every release supports the active LTS versions of Node.js at the time of the release, and declares the minimum in the `engines` field of every package. When a Node.js version reaches end of life, the next minor version of Concordance drops it and says so in its changelog.
- The container image carries a supported Node.js version and LibreOffice; it is rebuilt with every release, never in between.

## Checklist, before merging a version pull request

- [ ] the pipeline is green on `main` and on the pull request
- [ ] every changelog entry reads well from the user's point of view
- [ ] a minor version before `1.0.0` that breaks the contract says so in its entry
- [ ] the versions, the lockfile and the distribution pins in the diff all carry `v<x.y.z>`

After the merge, the `release` workflow does the rest; check that the tag, the release and its assets exist, and copy the image size from the `image` run into the release notes. Once the `publish` job is enabled, check as well that every package is on npm at the version, that the smoke test passed, and that the action repository and the component project carry the version.
