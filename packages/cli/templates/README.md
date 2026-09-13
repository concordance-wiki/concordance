# Note templates

One template per type implemented in the first version. Copy the file, keep the frontmatter keys you need, write the rest as prose. Every template passes the linter; the links between them resolve, so the folder is a tiny, consistent corpus about Concordance itself: its keyword pages, the publication threshold and the service that will answer model queries.

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

The `api` template declares [openapi.example.json](openapi.example.json), the model query contract, as its contract; [wsdl.example.wsdl](wsdl.example.wsdl) describes the forge bridge, a SOAP service with two operations, so that both contract plugins have an example to import: point a second `api` note's `contract` at it.

Each template is the `template.md` of its type module under `packages/profile/types/<type>/` (the guide "Adding a type" of the documentation describes the format), the source; `scripts/sync-templates.mjs` copies them here, next to this index and the example contracts, then copies this whole folder into the command line, and `pnpm lint` fails when the three places differ. `concordance init --templates` copies the shipped folder into `templates/` of the configuration repository, next to `concordance.yaml`; it never overwrites a file that exists there.
