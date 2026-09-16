import { resolve } from "node:path";
import { parseArgs } from "node:util";

import type { CanonicalModel, Entity } from "@concordance-wiki/core";
import { fragmentPath } from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import {
  linkedTo,
  linksOf,
  occurrencesIn,
  type Answer,
  type Bounds,
  type KeywordPassage,
} from "../query/answer.js";
import { shortestPath } from "../query/graph.js";
import {
  hasFilter,
  LIST_WITHOUT_FILTER_LIMIT,
  listEntities,
  listLine,
  type ListFilters,
} from "../query/list.js";
import { locateModel, type LocatedModel } from "../query/locate.js";
import { resolveExpression, type Resolution } from "../query/resolve.js";
import {
  ageOf,
  formatAnswer,
  formatCandidates,
  formatPath,
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
  "usage: concordance query <expression> [--occurrences] [--links] [--related] [--path <target> [--max-depth n]]",
  "       concordance query --list [--type t] [--domain d] [--application a] [--source s] [--status st] [--all]",
  "       options: [--model file] [--config file] [--format text|json] [--limit n] [--context n] [--no-age]",
];

const DEFAULT_MAX_DEPTH = 4;

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
  filters: ListFilters;
  path?: string;
  maxDepth: number;
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
      list: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
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
  if (values.list) {
    if (expression !== "")
      errors.push(
        "--list takes no expression; filter with --type, --domain, --application, --source or --status",
      );
    if (values.path !== undefined) errors.push("--list and --path do not go together");
    if (sections.size > 0)
      errors.push("--list lists entities; --occurrences, --links and --related read one");
  } else {
    if (expression === "") errors.push(...queryUsage);
    if (values.all) errors.push("--all goes with --list");
    if (hasFilter(filters))
      errors.push("--type, --domain, --application, --source and --status go with --list");
    if (values.path !== undefined && sections.size > 0) {
      errors.push("--path walks to another entity; --occurrences, --links and --related read one");
    }
  }
  if (
    errors.length > 0 ||
    limit === undefined ||
    context === undefined ||
    maxDepth === undefined ||
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
      filters,
      ...(values.path === undefined ? {} : { path: values.path }),
      maxDepth,
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

/** What the model knows about an expression: the note it names, where it is used, what it is linked to; or a list, or a path. */
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
  if (parsed.list) return list(io, located, parsed);
  const entity = resolveOrList(io, located.model, parsed.expression);
  if (entity === undefined) return exitCodes.invalid;
  if (parsed.path !== undefined) return walk(io, located, parsed, entity, parsed.path);
  const passages = entity.keyword === true ? passagesOf(io, located.directory, entity.id) : [];
  const answer: Answer = {
    model: modelOf(located, io, parsed.age),
    entity,
    occurrences: occurrencesIn(located.model, entity, passages, parsed.bounds),
    ...linksOf(linkedTo(located.model, entity), parsed.bounds),
  };
  const sections: Set<Section> =
    parsed.sections.size === 0 ? new Set(["occurrences", "links", "related"]) : parsed.sections;
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
