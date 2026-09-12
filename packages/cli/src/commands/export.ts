import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { ModelError, parseModel, toCypher } from "@concordance-wiki/core";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";

export const defaultModelFile = "dist/model.json";

const formats = ["cypher"] as const;

type Format = (typeof formats)[number];

function isFormat(value: string): value is Format {
  return formats.some((format) => format === value);
}

/** Turns `model.json` into another format; only Cypher exists, and it goes to stdout unless `--output` names a file. */
export function exportCommand(argv: string[], io: CommandIo): ExitCode {
  const { values } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", short: "f", default: "cypher" },
      model: { type: "string", short: "m", default: defaultModelFile },
      output: { type: "string", short: "o" },
    },
  });
  if (!isFormat(values.format)) {
    io.err(`--format ${values.format} is not available; expected ${formats.join(", ")}`);
    return exitCodes.failure;
  }
  const file = resolve(io.cwd, values.model);
  if (!io.fs.exists(file)) {
    io.err(`${file}: model file not found; run concordance build first`);
    return exitCodes.failure;
  }
  let text: string;
  try {
    text = toCypher(parseModel(io.fs.readText(file), file));
  } catch (error) {
    if (!(error instanceof ModelError)) throw error;
    for (const line of error.message.split("\n")) io.err(line);
    io.err(`${file}: ${String(error.issues.length)} error(s)`);
    return exitCodes.invalid;
  }
  if (values.output === undefined) {
    for (const line of text.trimEnd().split("\n")) io.out(line);
    return exitCodes.ok;
  }
  const target = resolve(io.cwd, values.output);
  io.fs.writeText(target, text);
  io.err(`${target}: written`);
  return exitCodes.ok;
}
