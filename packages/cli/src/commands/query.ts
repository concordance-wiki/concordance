import { resolve } from "node:path";
import { parseArgs } from "node:util";

import type { CanonicalModel, Entity } from "@concordance-wiki/core";
import { fragmentPath } from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import {
  explainLinks,
  linkedTo,
  linksOf,
  occurrencesIn,
  relationsOf,
  type Answer,
  type Bounds,
  type KeywordPassage,
  type LinkFilter,
} from "../query/answer.js";
import {
  changedWith,
  domainsOf,
  findingsOf,
  recentEntities,
  sourcesOf,
  statsOf,
  undefinedTerm,
  undefinedTerms,
} from "../query/corpus.js";
import { shortestPath, within } from "../query/graph.js";
import { findPassages, hasFragments } from "../query/passages.js";
import {
  hasFilter,
  LIST_WITHOUT_FILTER_LIMIT,
  listEntities,
  listLine,
  type ListFilters,
} from "../query/list.js";
import { locateModel, type LocatedModel } from "../query/locate.js";
import { resolveExpression, type Resolution } from "../query/resolve.js";
import { loadSearchIndex, searchIndex, type SearchOptions } from "../query/search.js";
import {
  ageOf,
  formatAnswer,
  formatCandidates,
  formatChangedWith,
  formatDomains,
  formatExplain,
  formatFindings,
  formatNear,
  formatPassages,
  formatPath,
  formatRecent,
  formatSources,
  formatStats,
  formatUndefined,
  formatUndefinedTerm,
  formatSearch,
  headline,
  type Section,
} from "../query/text.js";

const formats = ["text", "json"] as const;
type Format = (typeof formats)[number];

function isFormat(value: string): value is Format {
  // Widened to strings so that any input can be looked up; the guard narrows it back.
  return (formats as readonly string[]).includes(value);
}

/** A bound given on the command line: a positive integer, or nothing. */
function boundOf(value: string): number | undefined {
  return /^[1-9]\d*$/u.test(value) ? Number(value) : undefined;
}

function isPassage(value: unknown): value is KeywordPassage {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    typeof value.source === "string" &&
    "path" in value &&
    typeof value.path === "string" &&
    "line" in value &&
    typeof value.line === "number" &&
    "context" in value &&
    typeof value.context === "string"
  );
}

/** The passages of a keyword page, from the fragment written next to the model; none without it. */
function passagesOf(io: CommandIo, directory: string | undefined, id: string): KeywordPassage[] {
  if (directory === undefined) return [];
  const file = resolve(directory, fragmentPath(id));
  if (!io.fs.exists(file)) return [];
  const fragment: unknown = JSON.parse(io.fs.readText(file));
  const passages =
    typeof fragment === "object" && fragment !== null && "passages" in fragment
      ? fragment.passages
      : undefined;
  return Array.isArray(passages) ? passages.filter(isPassage) : [];
}

export const queryUsage = [
  "usage: concordance query <expression> [--occurrences] [--links [--direction in|out] [--relation slug]] [--related]",
  "       concordance query <expression> --path <target> [--max-depth n] | --near [--radius n] | --explain <target>",
  "       concordance query --list [--type t] [--domain d] [--application a] [--source s] [--status st] [--all]",
  "       concordance query --search <words> [--type t] [--domain d] [--application a] [--source s] [--keywords-only | --no-keywords]",
  "       concordance query --stats | --sources | --domains | --undefined [<expression>] [--min-files n] | --recent [--since day] [--source s]",
  "       concordance query <expression> --changed-with | --findings [<expression>] [--check id]",
  "       concordance query --text <phrase> [--source s]",
  "       options: [--model file] [--config file] [--format text|json] [--limit n] [--context n] [--no-age]",
];

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_RADIUS = 1;

/** The questions asked of the whole corpus rather than of one entity. */
const CORPUS_MODES = [
  "stats",
  "sources",
  "domains",
  "undefined",
  "recent",
  "changed-with",
  "findings",
] as const;
type CorpusMode = (typeof CORPUS_MODES)[number];

/** A day as `YYYY-MM-DD`, the way `--since` takes it; nothing for anything else. */
function dayOf(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}
const MAX_RADIUS = 3;

/** What the answer says about the model it was read from. */
function modelOf(located: LocatedModel, io: CommandIo, age: boolean): Answer["model"] {
  const { model } = located;
  return {
    file: located.file,
    at: model.build.at,
    tool: model.build.tool,
    sources: model.build.sources.map(
      (source) =>
        `${source.name}${source.commit === undefined ? "" : `@${source.commit.slice(0, 7)}`}`,
    ),
    ...(age ? { age: ageOf(model.build.at, io.clock.now()) } : {}),
  };
}

interface Parsed {
  expression: string;
  format: Format;
  bounds: Bounds;
  age: boolean;
  sections: Set<Section>;
  list: boolean;
  all: boolean;
  search?: string;
  noteless: SearchOptions["noteless"];
  filters: ListFilters;
  path?: string;
  maxDepth: number;
  near: boolean;
  radius: number;
  explain?: string;
  links: LinkFilter;
  corpus?: CorpusMode;
  text?: string;
  minFiles: number;
  since?: string;
  check?: string;
  model?: string;
  config?: string;
}

/** The options as given, or the lines that say why they cannot go together. */
function parse(argv: string[]): { parsed: Parsed } | { errors: string[] } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      model: { type: "string", short: "m" },
      config: { type: "string", short: "c" },
      format: { type: "string", short: "f", default: "text" },
      limit: { type: "string", default: "10" },
      context: { type: "string", default: "3" },
      "no-age": { type: "boolean", default: false },
      occurrences: { type: "boolean", default: false },
      links: { type: "boolean", default: false },
      related: { type: "boolean", default: false },
      path: { type: "string" },
      "max-depth": { type: "string" },
      near: { type: "boolean", default: false },
      radius: { type: "string" },
      explain: { type: "string" },
      direction: { type: "string" },
      relation: { type: "string" },
      stats: { type: "boolean", default: false },
      sources: { type: "boolean", default: false },
      domains: { type: "boolean", default: false },
      undefined: { type: "boolean", default: false },
      recent: { type: "boolean", default: false },
      "changed-with": { type: "boolean", default: false },
      findings: { type: "boolean", default: false },
      "min-files": { type: "string" },
      text: { type: "string" },
      since: { type: "string" },
      check: { type: "string" },
      list: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      search: { type: "string" },
      "keywords-only": { type: "boolean", default: false },
      "no-keywords": { type: "boolean", default: false },
      type: { type: "string" },
      domain: { type: "string" },
      application: { type: "string" },
      source: { type: "string" },
      status: { type: "string" },
    },
  });
  const errors: string[] = [];
  const expression = positionals.join(" ").trim();
  if (!isFormat(values.format)) {
    errors.push(`--format ${values.format} is not available; expected ${formats.join(", ")}`);
  }
  const limit = boundOf(values.limit);
  const context = boundOf(values.context);
  if (limit === undefined || context === undefined) {
    errors.push("--limit and --context take a positive integer");
  }
  const sections = new Set<Section>();
  if (values.occurrences) sections.add("occurrences");
  if (values.links) sections.add("links");
  if (values.related) sections.add("related");
  const filters: ListFilters = {
    ...(values.type === undefined ? {} : { type: values.type }),
    ...(values.domain === undefined ? {} : { domain: values.domain }),
    ...(values.application === undefined ? {} : { application: values.application }),
    ...(values.source === undefined ? {} : { source: values.source }),
    ...(values.status === undefined ? {} : { status: values.status }),
  };
  const maxDepth =
    values["max-depth"] === undefined ? DEFAULT_MAX_DEPTH : boundOf(values["max-depth"]);
  if (maxDepth === undefined) errors.push("--max-depth takes a positive integer");
  if (values["max-depth"] !== undefined && values.path === undefined) {
    errors.push("--max-depth goes with --path");
  }
  const radius = values.radius === undefined ? DEFAULT_RADIUS : boundOf(values.radius);
  if (radius === undefined || radius > MAX_RADIUS) {
    errors.push(`--radius takes an integer from 1 to ${String(MAX_RADIUS)}`);
  }
  if (values.radius !== undefined && !values.near) errors.push("--radius goes with --near");
  if (values.direction !== undefined && values.direction !== "in" && values.direction !== "out") {
    errors.push("--direction takes in or out");
  }
  const links: LinkFilter = {
    ...(values.direction === "in" || values.direction === "out"
      ? { direction: values.direction }
      : {}),
    ...(values.relation === undefined ? {} : { relation: values.relation }),
  };
  const walking = [values.path !== undefined, values.near, values.explain !== undefined].filter(
    Boolean,
  ).length;
  if (walking > 1) errors.push("--path, --near and --explain do not go together");
  if (
    (values.direction !== undefined || values.relation !== undefined) &&
    (walking > 0 || values.list || values.search !== undefined)
  ) {
    errors.push("--direction and --relation narrow the links of one entity");
  }
  if (values.text !== undefined) {
    if (values.text.trim().length < 3)
      errors.push("--text needs a phrase of three characters at least");
    if (expression !== "") errors.push("--text takes no expression");
    const others = Object.keys(filters).filter((key) => key !== "source");
    if (
      others.length > 0 ||
      values.list ||
      values.search !== undefined ||
      walking > 0 ||
      sections.size > 0 ||
      CORPUS_MODES.some((mode) => values[mode])
    ) {
      errors.push("--text searches the passages; only --source goes with it");
    }
  }
  const corpusModes = CORPUS_MODES.filter((mode) => values[mode]);
  const [corpus] = corpusModes;
  if (corpusModes.length > 1) {
    errors.push(`${corpusModes.map((mode) => `--${mode}`).join(", ")} do not go together`);
  }
  const minFiles = values["min-files"] === undefined ? 1 : boundOf(values["min-files"]);
  if (minFiles === undefined) errors.push("--min-files takes a positive integer");
  if (values["min-files"] !== undefined && !values.undefined)
    errors.push("--min-files goes with --undefined");
  const since = values.since === undefined ? undefined : dayOf(values.since);
  if (values.since !== undefined && since === undefined)
    errors.push("--since takes a day as YYYY-MM-DD");
  if (values.since !== undefined && !values.recent) errors.push("--since goes with --recent");
  if (values.check !== undefined && !values.findings) errors.push("--check goes with --findings");
  if (corpus !== undefined) {
    const takesExpression =
      corpus === "undefined" || corpus === "findings" || corpus === "changed-with";
    if (expression !== "" && !takesExpression) errors.push(`--${corpus} takes no expression`);
    if (expression === "" && corpus === "changed-with")
      errors.push("--changed-with needs the expression of a note");
    if (expression === "" && corpus === "findings" && values.check === undefined) {
      errors.push("--findings needs an expression or --check");
    }
    if (values.list || values.search !== undefined || walking > 0 || sections.size > 0) {
      errors.push(
        `--${corpus} asks the whole model; --list, --search, --path, --near, --explain, --occurrences, --links and --related do not go with it`,
      );
    }
    if (
      hasFilter(filters) &&
      !(corpus === "recent" && Object.keys(filters).every((key) => key === "source"))
    ) {
      errors.push(
        `--type, --domain, --application, --source and --status do not go with --${corpus}${corpus === "recent" ? " but --source" : ""}`,
      );
    }
  }
  const searching = values.search !== undefined;
  if (values["keywords-only"] && values["no-keywords"]) {
    errors.push("--keywords-only and --no-keywords do not go together");
  }
  if ((values["keywords-only"] || values["no-keywords"]) && !searching) {
    errors.push("--keywords-only and --no-keywords go with --search");
  }
  if (searching && values.list) errors.push("--search and --list do not go together");
  if (searching && values.status !== undefined) {
    errors.push("--status goes with --list; the search has no such facet");
  }
  if (corpus !== undefined || values.text !== undefined) {
    // The corpus question or the passages were checked above; the entity and list rules do not apply.
  } else if (values.list || searching) {
    const mode = values.list ? "--list" : "--search";
    if (expression !== "") {
      errors.push(
        `${mode} takes no expression; filter with --type, --domain, --application or --source`,
      );
    }
    if (walking > 0) errors.push(`${mode} and --path, --near or --explain do not go together`);
    if (sections.size > 0) {
      errors.push(`${mode} finds entities; --occurrences, --links and --related read one`);
    }
    if (searching && values.all) errors.push("--all goes with --list");
  } else {
    if (expression === "") errors.push(...queryUsage);
    if (values.all) errors.push("--all goes with --list");
    if (hasFilter(filters)) {
      errors.push(
        "--type, --domain, --application, --source and --status go with --list or --search",
      );
    }
    if (walking > 0 && sections.size > 0) {
      errors.push(
        "--path, --near and --explain walk the links; --occurrences, --links and --related read one",
      );
    }
  }
  if (
    errors.length > 0 ||
    limit === undefined ||
    context === undefined ||
    maxDepth === undefined ||
    radius === undefined ||
    minFiles === undefined ||
    !isFormat(values.format)
  ) {
    return { errors };
  }
  return {
    parsed: {
      expression,
      format: values.format,
      bounds: { limit, context },
      age: !values["no-age"],
      sections,
      list: values.list,
      all: values.all,
      ...(values.search === undefined ? {} : { search: values.search }),
      noteless: values["keywords-only"] ? "only" : values["no-keywords"] ? "exclude" : "any",
      filters,
      ...(values.path === undefined ? {} : { path: values.path }),
      maxDepth,
      near: values.near,
      radius,
      ...(values.explain === undefined ? {} : { explain: values.explain }),
      links,
      ...(corpus === undefined ? {} : { corpus }),
      ...(values.text === undefined ? {} : { text: values.text.trim() }),
      minFiles,
      ...(since === undefined ? {} : { since }),
      ...(values.check === undefined ? {} : { check: values.check }),
      ...(values.model === undefined ? {} : { model: values.model }),
      ...(values.config === undefined ? {} : { config: values.config }),
    },
  };
}

function resolveOrList(
  io: CommandIo,
  model: CanonicalModel,
  expression: string,
): Entity | undefined {
  const resolved: Resolution = resolveExpression(model, expression);
  if ("entity" in resolved) return resolved.entity;
  for (const line of formatCandidates(expression, resolved.candidates)) io.out(line);
  return undefined;
}

function list(io: CommandIo, located: LocatedModel, parsed: Parsed): ExitCode {
  const { model } = located;
  if (
    !hasFilter(parsed.filters) &&
    !parsed.all &&
    model.entities.length > LIST_WITHOUT_FILTER_LIMIT
  ) {
    io.err(
      `${String(model.entities.length)} entities: filter the list, or say --all to list them all`,
    );
    return exitCodes.failure;
  }
  const entities = listEntities(model, parsed.filters);
  if (parsed.format === "json") {
    io.out(JSON.stringify({ model: modelOf(located, io, parsed.age), entities }, null, 2));
    return exitCodes.ok;
  }
  const header = modelOf(located, io, parsed.age);
  io.out(
    `model ${header.file} (built ${header.at}${header.age === undefined ? "" : `, ${header.age}`}; sources ${header.sources.join(", ")})`,
  );
  io.out("");
  io.out(`${String(entities.length)} entities`);
  for (const entity of entities) io.out(`  ${listLine(entity)}`);
  return exitCodes.ok;
}

function walk(
  io: CommandIo,
  located: LocatedModel,
  parsed: Parsed,
  from: Entity,
  target: string,
): ExitCode {
  const to = resolveOrList(io, located.model, target);
  if (to === undefined) return exitCodes.invalid;
  const path = shortestPath(located.model, from, to, parsed.maxDepth);
  const header = modelOf(located, io, parsed.age);
  if (path === undefined) {
    io.out(`no path from ${from.id} to ${to.id} within ${String(parsed.maxDepth)} links`);
    return exitCodes.invalid;
  }
  if (parsed.format === "json") {
    io.out(JSON.stringify({ model: header, path }, null, 2));
    return exitCodes.ok;
  }
  for (const line of formatPath(header, from, to, path)) io.out(line);
  return exitCodes.ok;
}

function search(io: CommandIo, located: LocatedModel, parsed: Parsed, query: string): ExitCode {
  const answer = searchIndex(loadSearchIndex(io, located), query, {
    filters: parsed.filters,
    noteless: parsed.noteless,
    limit: parsed.bounds.limit,
  });
  if (answer.words.length === 0) {
    io.err(`--search needs a word of two characters at least; "${query}" holds none`);
    return exitCodes.failure;
  }
  const header = modelOf(located, io, parsed.age);
  if (parsed.format === "json") {
    io.out(JSON.stringify({ model: header, search: answer }, null, 2));
  } else {
    for (const line of formatSearch(header, answer)) io.out(line);
  }
  return answer.hits.length === 0 ? exitCodes.invalid : exitCodes.ok;
}

/** A question asked of the whole model: its counts, its spaces, its domains, what nobody defined, what changed. */
function corpusQuestion(
  io: CommandIo,
  located: LocatedModel,
  parsed: Parsed,
  mode: CorpusMode,
): ExitCode {
  const { model, config } = located;
  const header = modelOf(located, io, parsed.age);
  const { limit } = parsed.bounds;
  const emit = (json: Record<string, unknown>, text: string[]): void => {
    if (parsed.format === "json") {
      io.out(JSON.stringify({ model: header, ...json }, null, 2));
    } else {
      for (const line of text) io.out(line);
    }
  };
  switch (mode) {
    case "stats": {
      const stats = statsOf(model);
      emit({ stats }, formatStats(header, stats));
      return exitCodes.ok;
    }
    case "sources": {
      const sources = sourcesOf(model, config);
      emit({ sources }, formatSources(header, sources));
      return exitCodes.ok;
    }
    case "domains": {
      const domains = domainsOf(model, config);
      emit({ domains }, formatDomains(header, domains));
      return exitCodes.ok;
    }
    case "undefined": {
      if (parsed.expression === "") {
        const terms = undefinedTerms(model, parsed.minFiles);
        emit(
          { undefined: terms.slice(0, limit), more: Math.max(0, terms.length - limit) },
          formatUndefined(header, terms, limit),
        );
        return exitCodes.ok;
      }
      const term = undefinedTerm(model, parsed.expression);
      if (term === undefined) {
        io.out(`no recurring expression without a note under "${parsed.expression}"`);
        return exitCodes.invalid;
      }
      emit({ undefined: term }, formatUndefinedTerm(header, term, limit));
      return exitCodes.ok;
    }
    case "recent": {
      const entities = recentEntities(model, parsed.since, parsed.filters.source);
      emit(
        {
          since: parsed.since ?? null,
          recent: entities.slice(0, limit),
          more: Math.max(0, entities.length - limit),
        },
        formatRecent(header, parsed.since, entities, limit),
      );
      return exitCodes.ok;
    }
    case "changed-with": {
      const entity = resolveOrList(io, model, parsed.expression);
      if (entity === undefined) return exitCodes.invalid;
      const others = changedWith(model, entity);
      if (others === undefined) {
        io.out(`the model records no commit for ${entity.id}`);
        return exitCodes.invalid;
      }
      emit(
        {
          entity: entity.id,
          changed_with: others.slice(0, limit),
          more: Math.max(0, others.length - limit),
        },
        formatChangedWith(header, entity, others, limit),
      );
      return exitCodes.ok;
    }
    case "findings": {
      const entity =
        parsed.expression === "" ? undefined : resolveOrList(io, model, parsed.expression);
      if (parsed.expression !== "" && entity === undefined) return exitCodes.invalid;
      const findings = findingsOf(model, entity, parsed.check);
      const about = [
        ...(entity === undefined ? [] : [`about ${entity.id}`]),
        ...(parsed.check === undefined ? [] : [`under ${parsed.check}`]),
      ].join(" ");
      emit(
        { findings: findings.slice(0, limit), more: Math.max(0, findings.length - limit) },
        formatFindings(header, about, findings, limit),
      );
      return exitCodes.ok;
    }
  }
}

/** What the model knows about an expression: the note it names, where it is used, what it is linked to; or a list, a search, or a path. */
export async function queryCommand(argv: string[], io: CommandIo): Promise<ExitCode> {
  const options = parse(argv);
  if ("errors" in options) {
    for (const line of options.errors) io.err(line);
    return exitCodes.failure;
  }
  const { parsed } = options;
  const located = await locateModel(io, {
    ...(parsed.model === undefined ? {} : { model: parsed.model }),
    ...(parsed.config === undefined ? {} : { config: parsed.config }),
  });
  if (!located.ok) {
    for (const line of located.lines) io.err(line);
    return exitCodes.failure;
  }
  if (parsed.text !== undefined) {
    const { directory } = located;
    if (directory === undefined || !hasFragments(io, directory)) {
      io.err("passages need the fragments next to the model; none were found");
      return exitCodes.invalid;
    }
    const passages = findPassages(io, located.model, directory, parsed.text, parsed.filters.source);
    const header = modelOf(located, io, parsed.age);
    const { limit } = parsed.bounds;
    if (parsed.format === "json") {
      io.out(
        JSON.stringify(
          {
            model: header,
            phrase: parsed.text,
            passages: passages.slice(0, limit),
            more: Math.max(0, passages.length - limit),
          },
          null,
          2,
        ),
      );
    } else {
      for (const line of formatPassages(header, parsed.text, passages, limit)) io.out(line);
    }
    return passages.length === 0 ? exitCodes.invalid : exitCodes.ok;
  }
  if (parsed.corpus !== undefined) return corpusQuestion(io, located, parsed, parsed.corpus);
  if (parsed.list) return list(io, located, parsed);
  if (parsed.search !== undefined) return search(io, located, parsed, parsed.search);
  const entity = resolveOrList(io, located.model, parsed.expression);
  if (entity === undefined) return exitCodes.invalid;
  if (parsed.path !== undefined) return walk(io, located, parsed, entity, parsed.path);
  if (parsed.near) {
    const reached = within(located.model, entity, parsed.radius);
    const header = modelOf(located, io, parsed.age);
    if (parsed.format === "json") {
      io.out(JSON.stringify({ model: header, near: { radius: parsed.radius, reached } }, null, 2));
    } else {
      for (const line of formatNear(header, entity, parsed.radius, reached, parsed.bounds.limit)) {
        io.out(line);
      }
    }
    return exitCodes.ok;
  }
  if (parsed.explain !== undefined) {
    const other = resolveOrList(io, located.model, parsed.explain);
    if (other === undefined) return exitCodes.invalid;
    const links = explainLinks(located.model, entity, other);
    const header = modelOf(located, io, parsed.age);
    if (parsed.format === "json") {
      io.out(JSON.stringify({ model: header, explain: { other: other.id, links } }, null, 2));
    } else {
      for (const line of formatExplain(header, entity, other, links, parsed.bounds.context)) {
        io.out(line);
      }
    }
    return links.length === 0 ? exitCodes.invalid : exitCodes.ok;
  }
  if (parsed.links.relation !== undefined) {
    const relations = relationsOf(located.model);
    if (!relations.includes(parsed.links.relation)) {
      io.err(
        `--relation ${parsed.links.relation} names no relation of the model; it holds ${relations.join(", ")}`,
      );
      return exitCodes.failure;
    }
  }
  const passages = entity.keyword === true ? passagesOf(io, located.directory, entity.id) : [];
  const answer: Answer = {
    model: modelOf(located, io, parsed.age),
    entity,
    occurrences: occurrencesIn(located.model, entity, passages, parsed.bounds),
    ...linksOf(linkedTo(located.model, entity, parsed.links), parsed.bounds),
  };
  const narrowed = parsed.links.direction !== undefined || parsed.links.relation !== undefined;
  const sections: Set<Section> =
    parsed.sections.size === 0
      ? new Set(narrowed ? ["links"] : ["occurrences", "links", "related"])
      : parsed.sections;
  if (parsed.format === "json") {
    const kept: Partial<Answer> & Pick<Answer, "model" | "entity"> = {
      model: answer.model,
      entity: answer.entity,
    };
    if (sections.has("occurrences")) kept.occurrences = answer.occurrences;
    if (sections.has("links")) kept.links = answer.links;
    if (sections.has("related")) kept.related = answer.related;
    io.out(JSON.stringify(kept, null, 2));
    return exitCodes.ok;
  }
  for (const line of formatAnswer(answer, sections)) io.out(line);
  return exitCodes.ok;
}

export { headline };
