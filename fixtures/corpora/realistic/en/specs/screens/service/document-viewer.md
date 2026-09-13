---
roles: []
reads: [objects/resource, objects/representation]
url_pattern: /service/documents/:id
---
# Document viewer

Shows a converted document next to the note it twins with, through the [Model query API](../../api/model-query.md). The original binary is never served: the reader sees the representation only.

## Objects

- Reads: [resource](../../objects/resource.md), [representation](../../objects/representation.md)

## Actions

1. Pin → [pinned trail](pinned-trail.md)
2. Review the suggestions → [suggestion review](suggestion-review.md)
