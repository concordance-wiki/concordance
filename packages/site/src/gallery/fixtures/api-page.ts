import type { Mention, SlotProps, SpaceTree } from "../../slots.js";
import type { CitingPage } from "./corpus.js";
import { entityPage, corporateEntityPage } from "./entity-page.js";

/** The page of an API whose contract was imported: the contract section after the note, three operations, one without a note. */
export const apiPage: SlotProps["EntityPage"] = {
  ...entityPage,
  entity: {
    id: "specs/api/model-query",
    type: "api",
    typeLabel: "API",
    title: "Model query API",
    locale: "en",
  },
  highlights: [
    { name: "protocol", label: "protocol", values: [{ text: "rest" }] },
    { name: "version", label: "version", values: [{ text: "0" }] },
  ],
  sections: [
    {
      id: "definition",
      html: "<p>Serves the canonical model of the last build over HTTP, for the service screens and for the tools that cannot read <code>model.json</code>.</p>",
    },
  ],
  attributes: [
    { name: "status", label: "Status", values: [{ text: "target" }] },
    {
      name: "contract",
      label: "contract",
      values: [{ text: "contracts/model-query.openapi.json" }],
    },
  ],
  neighbours: {
    centre: "Model query API",
    neighbours: [
      {
        id: "specs/endpoints/list-entities",
        label: "List the entities",
        href: "../../endpoints/list-entities/",
        typeLabel: "endpoint",
        relation: "exposes",
        weight: 3,
        rank: 0,
      },
    ],
  },
  mentions: { mentions: [], initial: 20 },
  sources: [{ source: "specs", path: "api/model-query.md" }],
  contract: {
    title: "Model query API",
    version: "0.1.0",
    format: "openapi 3.1",
    importedAt: "2026-09-12T10:00:00.000Z",
    imported: { date: "2026-09-12", label: "imported 3 days ago", short: "3 days ago" },
    location: "contracts/model-query.openapi.json",
    downloadHref: "model-query.openapi.json",
    fragmentHref: "../../../fragments/specs/api/model-query.contract.json",
    operations: [
      {
        name: "listEntities",
        title: "List the entities",
        summary: "Returns the entities of the last build, in identifier order.",
        href: "../../endpoints/list-entities/",
        documented: true,
        method: "GET",
        path: "/entities",
        callers: "2 callers",
      },
      {
        name: "getEntity",
        title: "Read an entity",
        summary: "Returns one entity of the last build by identifier.",
        href: "../../endpoints/get-entity/",
        documented: true,
        method: "GET",
        path: "/entities/{id}",
        callers: "1 caller",
      },
      {
        name: "searchModel",
        title: "GET /search",
        summary: "Search the model",
        href: "searchmodel/",
        documented: false,
        method: "GET",
        path: "/search",
        callers: "0 callers",
      },
    ],
  },
};

/** The tree of the specifications space as the interface sees it: the api folder open, the current page listing its operations. */
const corporateApiSpaceTree: SpaceTree = {
  name: "specs",
  initials: "SP",
  href: "../../../#home-tree",
  nodes: [
    {
      label: "api",
      count: 3,
      children: [
        { label: "Canonical model API", href: "../canonical-model/" },
        { label: "Forge bridge API", href: "../forge-bridge/" },
        {
          label: "Model query API",
          current: true,
          children: [
            { label: "Read an entity", href: "../../endpoints/get-entity/" },
            { label: "List the entities", href: "../../endpoints/list-entities/" },
            { label: "Search the model", href: "../../endpoints/search-model/" },
            { label: "GET /findings", href: "listfindings/" },
          ],
        },
      ],
    },
    { label: "batches", count: 3 },
    { label: "endpoints", count: 7 },
    { label: "objects", count: 12 },
    { label: "processes", count: 5 },
    { label: "roles", count: 3 },
    { label: "rules", count: 10 },
    { label: "screens", count: 11 },
    { label: "tables", count: 4 },
  ],
};

/** A page of the fixtures corpus that evokes the model query API, at one line, with the passage it quotes. */
function apiMention(
  page: CitingPage,
  line: number,
  context: string,
  kind: Mention["kind"] = "recognised",
): Mention {
  const href = `../../../${page.id}/`;
  const surface = /model query api/i.exec(context)?.[0];
  return {
    kind,
    file: { label: page.path, href },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context,
    line,
    href: `${href}#L${String(line)}`,
    ...(surface === undefined ? {} : { surface }),
  };
}

const listEntities: CitingPage = {
  id: "specs/endpoints/list-entities",
  title: "List the entities",
  type: "endpoint",
  typeLabel: "Operation",
  path: "endpoints/list-entities.md",
};

const getEntity: CitingPage = {
  id: "specs/endpoints/get-entity",
  title: "Read an entity",
  type: "endpoint",
  typeLabel: "Operation",
  path: "endpoints/get-entity.md",
};

const searchModel: CitingPage = {
  id: "specs/endpoints/search-model",
  title: "Search the model",
  type: "endpoint",
  typeLabel: "Operation",
  path: "endpoints/search-model.md",
};

const documentViewer: CitingPage = {
  id: "specs/screens/service/document-viewer",
  title: "Document viewer",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/service/document-viewer.md",
};

const pinnedTrail: CitingPage = {
  id: "specs/screens/service/pinned-trail",
  title: "Pinned trail",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/service/pinned-trail.md",
};

const pinnedTrailDecision: CitingPage = {
  id: "decisions/pinned-trail-in-service",
  title: "Pinned trail in service",
  type: "decision",
  typeLabel: "Decision",
  path: "pinned-trail-in-service.md",
};

const scopeReview: CitingPage = {
  id: "meetings/2026-04-02-service-scope-review",
  title: "Service scope review",
  type: "meeting",
  typeLabel: "Meeting",
  path: "2026-04-02-service-scope-review.md",
};

/** The pages of the fixtures corpus that evoke the model query API: its operations, which name it at the top of their file, then the screens, the decision and the meeting. */
export const corporateApiMentions: Mention[] = [
  apiMention(
    listEntities,
    1,
    "Returns the entities of the last build, filtered by type, application or domain, in identifier order.",
    "written",
  ),
  apiMention(
    getEntity,
    1,
    "Returns one entity with its links and its representation when it has one.",
    "written",
  ),
  apiMention(
    searchModel,
    1,
    "Returns the entities and keyword pages whose title, alias or identifier matches the query, best score first.",
    "written",
  ),
  apiMention(
    documentViewer,
    12,
    "Reads the entity and its representation through the Model query API, one call per page opened.",
    "written",
  ),
  apiMention(
    pinnedTrail,
    9,
    "Resolves every pinned identifier through the Model query API when the trail is restored.",
    "written",
  ),
  apiMention(
    pinnedTrailDecision,
    6,
    "The trail lives in the service, next to the Model query API it reads.",
    "written",
  ),
  apiMention(
    scopeReview,
    18,
    "Participant-1 kept the model query API in the first release of the service; the suggestions wait.",
  ),
  apiMention(
    scopeReview,
    31,
    "Nothing of the model query API exists yet: the contract is ahead of the code.",
  ),
];

/** The model query API of the fixtures corpus, laid out as the corporate chrome shows an interface: the tree with its operations under it, the operations table with its gaps, the contract block, the five keys and the operations first among the related pages. */
export const corporateApiPage: SlotProps["EntityPage"] = {
  entity: {
    id: "specs/api/model-query",
    type: "api",
    typeLabel: "API",
    title: "Model query API",
    locale: "en",
  },
  space: corporateApiSpaceTree,
  breadcrumb: [
    { label: "specs", href: "../../../#home-tree" },
    { label: "api" },
    { label: "Model query API" },
  ],
  changed: { date: "2026-09-04", label: "Changed 9 days ago", short: "9 days ago" },
  highlights: [
    { name: "protocol", label: "Protocol", values: [{ text: "rest" }] },
    { name: "exposure", label: "Exposure", values: [{ text: "apim" }] },
    { name: "version", label: "Version", values: [{ text: "0" }] },
    { name: "status", label: "Status", values: [{ text: "target" }] },
    {
      name: "contract",
      label: "Contract",
      values: [{ text: "contracts/model-query.openapi.json" }],
    },
  ],
  sections: [
    {
      id: "section-lead",
      html: '<p>Serves the <a href="../../../glossary/canonical-model/" class="recognised">canonical model</a> of the last <a href="../../objects/build/" class="recognised">build</a> over HTTP, for the service screens and for the tools that cannot read <code>model.json</code>. Nothing of it exists in this version. The <a href="../../../specs/api/contracts/model-query-openapi/" class="written">contract</a> lists three operations, which the contract import matches to the operation notes; the suggestion review screen is declared as a consumer although it works on the <a href="../../../glossary/lock-file/" class="recognised">lock file</a> directly, which the consumer mismatch check reports.</p>',
    },
    {
      id: "section-consumers",
      heading: "Consumers",
      key: "consumers",
      html: '<ul><li><a href="../../screens/service/document-viewer/" class="written">Document viewer</a></li><li><a href="../../screens/service/pinned-trail/" class="written">Pinned trail</a></li></ul>',
    },
    {
      id: "section-objects",
      heading: "Objects",
      key: "objects",
      html: '<ul><li><a href="../../objects/entity/" class="written">Entity</a></li><li><a href="../../objects/link/" class="written">Link</a></li><li><a href="../../objects/finding/" class="written">Finding</a></li></ul>',
    },
  ],
  attributes: [
    { name: "application", label: "Application", values: [{ text: "concordance-service" }] },
    { name: "domain", label: "Domain", values: [{ text: "publication" }] },
    { name: "status", label: "Status", values: [{ text: "target" }] },
    { name: "protocol", label: "Protocol", values: [{ text: "rest" }] },
    { name: "exposure", label: "Exposure", values: [{ text: "apim" }] },
    {
      name: "contract",
      label: "Contract",
      values: [{ text: "contracts/model-query.openapi.json" }],
    },
    {
      name: "consumers",
      label: "Consumers",
      values: [{ text: "Suggestion review", href: "../../screens/service/suggestion-review/" }],
    },
    { name: "version", label: "Version", values: [{ text: "0" }] },
  ],
  labels: { ...corporateEntityPage.labels, neighbourPages: "6 pages" },
  neighbours: {
    centre: "Model query API",
    neighbours: [
      {
        id: listEntities.id,
        label: listEntities.title,
        href: "../../endpoints/list-entities/",
        typeLabel: "Operation",
        typeGlyph: "endpoint",
        relation: "exposes",
        weight: 3,
        rank: 0,
      },
      {
        id: getEntity.id,
        label: getEntity.title,
        href: "../../endpoints/get-entity/",
        typeLabel: "Operation",
        typeGlyph: "endpoint",
        relation: "exposes",
        weight: 1,
        rank: 1,
      },
      {
        id: searchModel.id,
        label: searchModel.title,
        href: "../../endpoints/search-model/",
        typeLabel: "Operation",
        typeGlyph: "endpoint",
        relation: "exposes",
        weight: 1,
        rank: 2,
      },
      {
        id: documentViewer.id,
        label: documentViewer.title,
        href: "../../screens/service/document-viewer/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "serves",
        weight: 2,
        rank: 3,
      },
      {
        id: pinnedTrail.id,
        label: pinnedTrail.title,
        href: "../../screens/service/pinned-trail/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "serves",
        weight: 2,
        rank: 4,
      },
      {
        id: "specs/objects/entity",
        label: "Entity",
        href: "../../objects/entity/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 3,
        rank: 5,
      },
    ],
    total: 9,
  },
  mentions: {
    ...corporateEntityPage.mentions,
    mentions: corporateApiMentions,
    pages: 7,
    fragmentHref: "../../../fragments/specs/api/model-query.mentions.json",
  },
  sources: [
    {
      source: "specs",
      path: "api/model-query.md",
      editHref: "https://forge.example/specs/edit/main/api/model-query.md",
    },
  ],
  contract: {
    title: "Model query API",
    version: "0.1.0",
    format: "openapi 3.1",
    importedAt: "2026-09-10T00:26:40.000Z",
    imported: { date: "2026-09-10", label: "imported 3 days ago", short: "3 days ago" },
    location: "contracts/model-query.openapi.json",
    downloadHref: "model-query.openapi.json",
    fragmentHref: "../../../fragments/specs/api/model-query.contract.json",
    operations: [
      {
        name: "getEntity",
        title: "Read an entity",
        summary: "Read an entity",
        href: "../../endpoints/get-entity/",
        documented: true,
        method: "GET",
        path: "/entities/{id}",
        callers: "1 caller",
      },
      {
        name: "listEntities",
        title: "List the entities",
        summary: "List the entities of the model",
        href: "../../endpoints/list-entities/",
        documented: true,
        method: "GET",
        path: "/entities",
        callers: "3 callers",
      },
      {
        name: "searchModel",
        title: "Search the model",
        summary: "Search the model",
        href: "../../endpoints/search-model/",
        documented: true,
        method: "GET",
        path: "/search",
        callers: "1 caller",
      },
      {
        name: "listFindings",
        title: "GET /findings",
        summary: "List the findings of the last build",
        href: "listfindings/",
        documented: false,
        method: "GET",
        path: "/findings",
        callers: "0 callers",
      },
    ],
    unmatched: [
      {
        name: "suggestLinks",
        title: "Suggest links",
        summary: "Proposes the links a note could write, from the candidates of the model.",
        href: "../../endpoints/suggest-links/",
        documented: true,
        callers: "1 caller",
      },
    ],
    labels: {
      operations: "Operations",
      operationsLead: "Matched to the contract by operation name.",
      gapsLead:
        "The rows in italics are gaps: present in the contract without a page, or described without existing in the contract.",
      method: "Method",
      path: "Path",
      operation: "Operation",
      callersColumn: "Callers",
      noOperation: "The contract declares no operation.",
      withoutPage: "present in the contract, without a page",
      notInContract: "described, absent from the contract",
      unknownPath: "unknown path",
      contract: "Interface contract",
      download: "Download the contract",
      viewerNote:
        "No schema is copied into the text: the page shows the contract, it does not duplicate it.",
      fiveKeys: "Five keys, no more. The operations come from the contract, not from the header.",
      operationsFirst:
        "On an interface the operations rise to the top: that is the grain we work at.",
    },
  },
};
