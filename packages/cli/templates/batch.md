---
type: batch
schedule: "0 2 * * *"
window: 02:00-04:00
depends_on: []
---
# Nightly build

Publishes the [keyword pages](business_object.md) accepted during the day and refreshes the site. Screens show a page count that is only updated after this batch, which the home page states explicitly.

## Reads

- [Keyword page](business_object.md)

## Writes

- [ENTITIES table](data_object.md)
