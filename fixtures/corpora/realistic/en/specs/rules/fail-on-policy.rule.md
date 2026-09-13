---
severity: blocking
condition: a build raises an error, or more unconverted documents than the configured maximum
---
# Fail-on policy

Errors fail the build; warnings and informations never do. A build with more unconverted documents than the configured maximum fails too, so that a broken converter is noticed before the site goes stale.

## Applies to

- [Build pipeline](../processes/build-pipeline.md)
- [Lint in a merge request](../processes/lint-in-merge-request.md)
- [To-do page](../screens/to-do-page.md)
