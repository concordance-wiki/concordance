# Note templates

One template per type implemented in the first version. Copy the file, keep the frontmatter keys you need, write the rest as prose. Every template passes the linter; the links between them resolve, so the folder is a tiny, consistent corpus about a fictional personal insurer.

Frontmatter carries what qualifies the note, nothing more. Sections whose heading is mapped in the profile (`## Objects`, `## Actions`, `## Rules`, `## Steps`, `## Consumers`, `## Reads`, `## Writes`, `## Applies to`, `## Affects`) produce typed relations for the notes they mention.

| Type | Template | Mapped sections |
|---|---|---|
| application | [application.md](application.md) | — |
| domain | [domain.md](domain.md) | — |
| role | [role.md](role.md) | — |
| process | [process.md](process.md) | `## Steps` |
| business_object | [business_object.md](business_object.md) | — |
| rule | [rule.md](rule.md) | `## Applies to` |
| term | [term.md](term.md) | — |
| screen | [screen.md](screen.md) | `## Objects`, `## Actions`, `## Rules` |
| api | [api.md](api.md) | `## Consumers`, `## Objects` |
| endpoint | [endpoint.md](endpoint.md) | `## Consumers`, `## Rules` |
| batch | [batch.md](batch.md) | `## Reads`, `## Writes` |
| data_object | [data_object.md](data_object.md) | — |
| decision | [decision.md](decision.md) | `## Affects` |
| document | [document.md](document.md) | — |
| meeting | [meeting.md](meeting.md) | — |

`concordance init` copies these templates into the configuration repository.
