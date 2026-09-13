---
execution: mixed
triggers: [repository declared]
---
# Onboard a repository

A team adds its repository to the corpus.

## Steps

1. The [maintainer](../roles/maintainer.md) declares the source in the configuration and validates it.
2. The first build clones the repository at depth 1 on the declared ref and reads every resource.
   - If a note breaks the [identifier pattern](../rules/identifier-pattern.rule.md), the build stops and go to step 1.
3. The [author](../roles/author.md) reviews the entity pages of the new source.
4. End.
