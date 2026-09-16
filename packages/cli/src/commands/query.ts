import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { ModelError, parseModel, type CanonicalModel } from "@concordance-wiki/core";
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
import { resolveExpression } from "../query/resolve.js";
import { ageOf, formatAnswer, formatCandidates } from "../query/text.js";
import { defaultModelFile } from "./export.js";

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
function passagesOf(io: CommandIo, modelFile: string, id: string): KeywordPassage[] {
  const file = resolve(dirname(modelFile), fragmentPath(id));
  if (!io.fs.exists(file)) return [];
  const fragment: unknown = JSON.parse(io.fs.readText(file));
  const passages =
    typeof fragment === "object" && fragment !== null && "passages" in fragment
      ? fragment.passages
      : undefined;
  return Array.isArray(passages) ? passages.filter(isPassage) : [];
}

export const queryUsage =
  "usage: concordance query <expression> [--model dist/model.json] [--format text|json] [--limit n] [--context n] [--no-age]";

/** What the model knows about an expression: the note it names, where it is used, what it is linked to. */
export function queryCommand(argv: string[], io: CommandIo): ExitCode {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      model: { type: "string", short: "m", default: defaultModelFile },
      format: { type: "string", short: "f", default: "text" },
      limit: { type: "string", default: "10" },
      context: { type: "string", default: "3" },
      "no-age": { type: "boolean", default: false },
    },
  });
  const expression = positionals.join(" ").trim();
  if (expression === "") {
    io.err(queryUsage);
    return exitCodes.failure;
  }
  if (!isFormat(values.format)) {
    io.err(`--format ${values.format} is not available; expected ${formats.join(", ")}`);
    return exitCodes.failure;
  }
  const limit = boundOf(values.limit);
  const context = boundOf(values.context);
  if (limit === undefined || context === undefined) {
    io.err("--limit and --context take a positive integer");
    return exitCodes.failure;
  }
  const file = resolve(io.cwd, values.model);
  if (!io.fs.exists(file)) {
    io.err(`${file}: model file not found; run concordance build first or name one with --model`);
    return exitCodes.failure;
  }
  let model: CanonicalModel;
  try {
    model = parseModel(io.fs.readText(file), file);
  } catch (error) {
    if (!(error instanceof ModelError)) throw error;
    for (const line of error.message.split("\n")) io.err(line);
    return exitCodes.failure;
  }
  const resolved = resolveExpression(model, expression);
  if ("candidates" in resolved) {
    for (const line of formatCandidates(expression, resolved.candidates)) io.out(line);
    return exitCodes.invalid;
  }
  const bounds: Bounds = { limit, context };
  const passages = resolved.entity.keyword === true ? passagesOf(io, file, resolved.entity.id) : [];
  const answer: Answer = {
    model: {
      file: values.model,
      at: model.build.at,
      tool: model.build.tool,
      sources: model.build.sources.map(
        (source) =>
          `${source.name}${source.commit === undefined ? "" : `@${source.commit.slice(0, 7)}`}`,
      ),
      ...(values["no-age"] ? {} : { age: ageOf(model.build.at, io.clock.now()) }),
    },
    entity: resolved.entity,
    occurrences: occurrencesIn(model, resolved.entity, passages, bounds),
    ...linksOf(linkedTo(model, resolved.entity), bounds),
  };
  if (values.format === "json") {
    io.out(JSON.stringify(answer, null, 2));
    return exitCodes.ok;
  }
  for (const line of formatAnswer(answer)) io.out(line);
  return exitCodes.ok;
}
