import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { queryCommand } from "../commands/query.js";

/** What a harness reads to present a tool: its name, what it does, the shape of its arguments. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** The arguments of a call, as the harness sends them: a JSON object. */
export type ToolArguments = Record<string, unknown>;

const FORMAT = {
  format: {
    type: "string",
    enum: ["text", "json"],
    description: "text (the default) for a context, json for a program.",
  },
};
const LIMIT = {
  limit: {
    type: "integer",
    minimum: 1,
    description: "How many entries a list keeps; the rest is counted.",
  },
};
const FACETS = {
  type: { type: "string", description: "Keep the entities of this type." },
  domain: { type: "string", description: "Keep the entities of this domain." },
  application: { type: "string", description: "Keep the entities of this application." },
  source: { type: "string", description: "Keep the entities of this source." },
};

function schema(
  properties: Record<string, unknown>,
  required: readonly string[] = [],
): Record<string, unknown> {
  return {
    type: "object",
    properties: { ...properties, ...FORMAT, ...LIMIT },
    ...(required.length === 0 ? {} : { required: [...required] }),
    additionalProperties: false,
  };
}

/** The tools of the façade, one per family of questions `concordance query` answers. */
export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "lookup",
    description:
      "What the model knows about an expression: the note it names (resolved by identifier, title, alias, normalised form or prefix; a term wins among several notes, otherwise the candidates are listed), where it is used with file and line, what it is linked to with relation, confidence and methods, and the decisions and sessions among those links.",
    inputSchema: schema(
      {
        expression: {
          type: "string",
          description: "An identifier, a title, an alias or a prefix.",
        },
        sections: {
          type: "array",
          items: { type: "string", enum: ["occurrences", "links", "related"] },
          description: "The sections to keep; every section when absent.",
        },
        direction: {
          type: "string",
          enum: ["in", "out"],
          description: "Keep the links read in one direction.",
        },
        relation: { type: "string", description: "Keep the links carrying this relation." },
        context: { type: "integer", minimum: 1, description: "How many occurrences a note keeps." },
      },
      ["expression"],
    ),
  },
  {
    name: "search",
    description:
      "The search of the site, ranked and facetted: the same words, ranking and facets as the results page, from the index the site wrote, else from the model and its fragments.",
    inputSchema: schema(
      {
        words: { type: "string", description: "The words to search, two characters at least." },
        ...FACETS,
        keywords: {
          type: "string",
          enum: ["only", "exclude"],
          description: "only keeps the keyword pages alone, exclude leaves them out.",
        },
      },
      ["words"],
    ),
  },
  {
    name: "relations",
    description:
      "The questions of the graph: near lists what lies within a few links of the expression, explain shows every provenance of every link between the expression and the target, path walks the fewest links from the expression to the target.",
    inputSchema: schema(
      {
        expression: { type: "string", description: "The entity the question starts from." },
        mode: { type: "string", enum: ["near", "explain", "path"] },
        target: { type: "string", description: "The other entity, for explain and path." },
        radius: {
          type: "integer",
          minimum: 1,
          maximum: 3,
          description: "How many links near walks.",
        },
        max_depth: { type: "integer", minimum: 1, description: "How many links path may walk." },
        context: {
          type: "integer",
          minimum: 1,
          description: "How many occurrences a provenance keeps, for explain.",
        },
      },
      ["expression", "mode"],
    ),
  },
  {
    name: "list",
    description:
      "The entities of the model, filtered by type, domain, application, source and status, one line each.",
    inputSchema: schema({
      ...FACETS,
      status: { type: "string", description: "Keep the entities of this status." },
      all: { type: "boolean", description: "List a large model without a filter." },
    }),
  },
  {
    name: "corpus",
    description:
      "A question of the whole model: stats counts everything, sources and domains list the spaces and the domains, undefined lists the recurring expressions without a note (or where one was read, with an expression), recent lists the notes changed since a day, changed_with lists the notes whose last commit is that of the expression, findings lists what the build recorded about the expression or under a check.",
    inputSchema: schema(
      {
        question: {
          type: "string",
          enum: ["stats", "sources", "domains", "undefined", "recent", "changed_with", "findings"],
        },
        expression: {
          type: "string",
          description: "An expression, for undefined, changed_with and findings.",
        },
        min_files: {
          type: "integer",
          minimum: 1,
          description: "For undefined: in how many files an expression recurs at least.",
        },
        since: { type: "string", description: "For recent: a day as YYYY-MM-DD." },
        source: { type: "string", description: "For recent: keep one source." },
        check: { type: "string", description: "For findings: the identifier of a check." },
      },
      ["question"],
    ),
  },
  {
    name: "passages",
    description:
      "Where a phrase is written or spoken: the positions of the documents and the transcripts, with page, slide or timecode and speaker, and the sections of the notes.",
    inputSchema: schema(
      {
        phrase: { type: "string", description: "The phrase to find, three characters at least." },
        source: { type: "string", description: "Keep one source." },
      },
      ["phrase"],
    ),
  },
];

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function integer(value: unknown): string | undefined {
  return typeof value === "number" && Number.isInteger(value) ? String(value) : undefined;
}

function option(name: string, value: string | undefined): string[] {
  return value === undefined ? [] : [`--${name}`, value];
}

/** The common tail of every call: the format, the bound, the model named at the start of the server, no age. */
function tail(args: ToolArguments, model: readonly string[]): string[] {
  return [
    ...option("format", text(args["format"])),
    ...option("limit", integer(args["limit"])),
    ...model,
    "--no-age",
  ];
}

function facets(args: ToolArguments): string[] {
  return [
    ...option("type", text(args["type"])),
    ...option("domain", text(args["domain"])),
    ...option("application", text(args["application"])),
    ...option("source", text(args["source"])),
  ];
}

/** The arguments of `concordance query` a tool call stands for; none for a tool the façade does not have. */
export function argvOf(
  tool: string,
  args: ToolArguments,
  model: readonly string[],
): string[] | undefined {
  switch (tool) {
    case "lookup": {
      const sections = Array.isArray(args["sections"]) ? args["sections"] : [];
      return [
        text(args["expression"]) ?? "",
        ...sections.flatMap((section) => (typeof section === "string" ? [`--${section}`] : [])),
        ...option("direction", text(args["direction"])),
        ...option("relation", text(args["relation"])),
        ...option("context", integer(args["context"])),
        ...tail(args, model),
      ];
    }
    case "search":
      return [
        "--search",
        text(args["words"]) ?? "",
        ...facets(args),
        ...(args["keywords"] === "only"
          ? ["--keywords-only"]
          : args["keywords"] === "exclude"
            ? ["--no-keywords"]
            : []),
        ...tail(args, model),
      ];
    case "relations": {
      const mode = text(args["mode"]);
      const target = text(args["target"]) ?? "";
      const walk =
        mode === "near"
          ? ["--near", ...option("radius", integer(args["radius"]))]
          : mode === "explain"
            ? ["--explain", target, ...option("context", integer(args["context"]))]
            : ["--path", target, ...option("max-depth", integer(args["max_depth"]))];
      return [text(args["expression"]) ?? "", ...walk, ...tail(args, model)];
    }
    case "list":
      return [
        "--list",
        ...facets(args),
        ...option("status", text(args["status"])),
        ...(args["all"] === true ? ["--all"] : []),
        ...tail(args, model),
      ];
    case "corpus": {
      const question = text(args["question"]) ?? "stats";
      const expression = text(args["expression"]);
      return [
        ...(expression === undefined ? [] : [expression]),
        `--${question.replaceAll("_", "-")}`,
        ...option("min-files", integer(args["min_files"])),
        ...option("since", text(args["since"])),
        ...option("source", text(args["source"])),
        ...option("check", text(args["check"])),
        ...tail(args, model),
      ];
    }
    case "passages":
      return [
        "--text",
        text(args["phrase"]) ?? "",
        ...option("source", text(args["source"])),
        ...tail(args, model),
      ];
    default:
      return undefined;
  }
}

/** What a call gives back: the text of the answer and whether the command refused the call. */
export interface ToolResult {
  text: string;
  isError: boolean;
}

/** One call of a tool: the query run with the arguments the call stands for, its two streams gathered as the answer. */
export async function callTool(
  io: CommandIo,
  model: readonly string[],
  tool: string,
  args: ToolArguments,
): Promise<ToolResult | undefined> {
  const argv = argvOf(tool, args, model);
  if (argv === undefined) return undefined;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status: ExitCode = await queryCommand(argv, {
    ...io,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
  });
  return {
    text: [...stdout, ...stderr].join("\n"),
    // A refusal of the options is an error of the call; an answer that found nothing is an answer.
    isError: status === exitCodes.failure,
  };
}
