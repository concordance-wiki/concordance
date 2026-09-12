# Releasing

Releases are cut by the maintainers. This page lists what a release produces and the steps that are not automated yet.

## Versions and changelog

Versions and the changelog are managed by Changesets: every pull request that changes a published package adds a changeset, and the release applies them (`pnpm changeset version`), commits the bumped manifests and the changelog, and tags the commit `v<version>`. The packages under `packages/`, `plugins/` and `presets/` are published to npm from that tag; the unscoped `concordance` preset is what integrators install.

## Container image

The `image` workflow runs on every tag `v*` (and on pull requests that touch the image inputs, without publishing). It builds `concordancewiki/concordance` from the `Dockerfile` at the root of the repository with the version of the tag, checks that the image runs unprivileged as uid 1000 with the `concordance` entry point, LibreOffice, git and the fonts, builds the golden corpus once inside the container and once outside with the same `SOURCE_DATE_EPOCH`, compares the two output trees byte for byte with `scripts/compare-builds.mjs`, verifies that the container writes nothing but `dist/` and the cache, and measures the image with `docker image inspect`.

The image size is written to the summary of the run under "Container image"; copy it into the release notes so that integrators see the weight of what they pull. The `publish` job pushes the image tested above under `concordancewiki/concordance:<version>` and `:latest`; it is disabled in the workflow until the first release. Enabling it takes three steps by the maintainer of the Docker Hub organisation: create the repository, add the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets (a read-write access token, not the account password), and replace the `if: false` of the job with `startsWith(github.ref, 'refs/tags/v')`.

## Checklist

1. Every changeset of the release is merged and `pnpm check` is green on `main`.
2. `pnpm changeset version`, review the changelog, commit, tag `v<version>`, push the tag.
3. Publish the npm packages from the tag.
4. Wait for the `image` workflow: the build job must be green, and the `publish` job, once enabled, pushes both tags.
5. Write the release notes from the changelog and add the image size from the run summary.
