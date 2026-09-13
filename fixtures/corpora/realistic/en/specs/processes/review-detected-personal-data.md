---
execution: human
triggers: [personal data detected in a transcript]
---
# Review detected personal data

A build flags a passage that looks like personal data.

## Steps

1. The build raises a finding on the passage.
2. The [maintainer](../roles/maintainer.md) reviews it on [to-do page](../screens/to-do-page.md).
   - If the passage is a false positive, go to step 4.
3. The [author](../roles/author.md) pseudonymises the passage or excludes the file.
4. End.
