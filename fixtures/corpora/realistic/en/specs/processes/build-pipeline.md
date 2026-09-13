---
execution: mixed
triggers: [commit on a declared source, manual run]
---
# Build pipeline

A maintainer or the nightly build turns the sources into a site.

## Steps

1. The [maintainer](../roles/maintainer.md) runs the build, which validates the configuration.
   - If the configuration is invalid, go to step 7.
2. Every source is cloned or updated and its resources are read.
3. Notes are parsed and typed; contracts are imported.
4. Occurrences are scanned and candidates are counted.
5. Links are inferred, the lock file is applied and the [Canonical model API](../api/canonical-model.md) file is written.
   - If the [fail-on policy](../rules/fail-on-policy.rule.md) is met, go to step 7.
6. The site is rendered and published.
7. End.
