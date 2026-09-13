---
execution: service
triggers: [merge request opened or updated]
---
# Lint in a merge request

A forge checks the notes a merge request changes.

## Steps

1. The forge runs the linter on the changed files.
   - If the [fail-on policy](../rules/fail-on-policy.rule.md) is met, the pipeline fails and go to step 4.
2. The forge report is posted on the merge request.
3. The [author](../roles/author.md) fixes the findings and the [quality owner](../roles/quality-owner.md) acknowledges the rest.
4. End.
