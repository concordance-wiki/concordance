---
type: process
execution: mixed
triggers: [candidate proposed]
---
# Review a candidate expression

The recogniser proposes an expression that no note defines.

## Steps

1. The [glossary owner](role.md) opens the candidate.
2. The glossary owner accepts it on the [to-do page](screen.md).
   - If the [publication threshold](rule.md) is not met, go to step 5.
3. The system calls the [Model query API](api.md).
4. A [keyword page](business_object.md) is created in the model.
5. End.
