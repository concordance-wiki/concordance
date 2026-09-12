---
type: screen
roles: [role]
url_pattern: /todo/:id
status: valid
---
# To-do page

Lets a [glossary owner](role.md) accept a [candidate expression](term.md) as a keyword page. Reachable from the home page and from search.

## Review

The glossary owner reads the occurrences and their files. On acceptance the expression is checked against the [publication threshold](rule.md); when it is not met the screen shows the count returned by the [Model query API](api.md).

## Objects

- Reads: [keyword page](business_object.md)
- Writes: [keyword page](business_object.md)

## Actions

1. Accept → keyword page
2. Reject → to-do page

## Rules

- [Publication threshold](rule.md)
