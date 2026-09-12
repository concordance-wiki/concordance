---
type: rule
severity: blocking
condition: an expression occurs fewer than three times or in fewer than two files
---
# Publication threshold

An expression gets a keyword page only when it occurs at least three times across at least two files. The check happens in the [Model query API](api.md) only; screens display the count it returns and never recompute the threshold, as recorded in the [threshold checked server-side](decision.md) decision.

## Applies to

- [To-do page](screen.md)
- [Model query API](api.md)
- [Keyword page](business_object.md)
