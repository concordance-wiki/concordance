import { buildCommand } from "./commands/build.js";
import { exportCommand } from "./commands/export.js";
import { galleryCommand } from "./commands/gallery.js";
import { initCommand } from "./commands/init.js";
import { lintCommand } from "./commands/lint.js";
import { mcpCommand } from "./commands/mcp.js";
import { queryCommand } from "./commands/query.js";
import { renderCommand } from "./commands/render.js";
import { validateConfigCommand } from "./commands/validate-config.js";
import { exitCodes, type CommandIo, type ExitCode } from "./io.js";

type Command = (argv: string[], io: CommandIo) => ExitCode | Promise<ExitCode>;

const commands: Record<string, Command> = {
  build: buildCommand,
  export: exportCommand,
  gallery: galleryCommand,
  init: initCommand,
  lint: lintCommand,
  mcp: mcpCommand,
  query: queryCommand,
  render: renderCommand,
  "validate-config": validateConfigCommand,
};

export const usage = [
  "usage: concordance <command> [options]",
  "",
  "commands:",
  "  build [--config file] [--output dir] [--timings]",
  "                                        validate the configuration, build the model and render the site; --timings prints where the time went",
  "  export [--format cypher] [--model dist/model.json] [--output file]",
  "                                        turn the model into a Cypher script (stdout by default)",
  "  gallery [--output dir] [--theme plugin] [--config file]",
  "                                        render every slot with fixture data through the theme",
  "  init [directory] [--templates]        write a minimal configuration file, and the note templates",
  "  lint [--scope repo|global] [--source name] [--config file] [--fail-on error|warning|info]",
  "       [--format text|json|sarif|junit] [--output file] [--fix] [--dry-run]",
  "                                        check the current repository alone, or against the published model",
  "  mcp [--model dist/model.json] [--config file]",
  "                                        serve the questions of query to an agent over standard input, one tool per family",
  "  query <expression> [--occurrences] [--links] [--related] [--path <target>]",
  "  query --list [--type t] [--domain d] [--application a] [--source s]",
  "                                        what the model knows about an expression, a list of its entities, or the way between two",
  "  render [--model dist/model.json] [--output dir] [--config file]",
  "                                        render the site again from an existing model, without the sources",
  "  validate-config [--config file]       check the configuration and report its errors",
  "",
  "exit codes: 0 ok, 1 invalid configuration or findings, 2 execution error",
];

export async function main(argv: string[], io: CommandIo): Promise<ExitCode> {
  const [name, ...rest] = argv;
  if (name === undefined || name === "--help" || name === "-h") {
    for (const line of usage) io.out(line);
    return name === undefined ? exitCodes.failure : exitCodes.ok;
  }
  // Own keys only: `toString` or `constructor` would otherwise find a method of Object.prototype.
  const command = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (command === undefined) {
    io.err(`unknown command: ${name}`);
    for (const line of usage) io.err(line);
    return exitCodes.failure;
  }
  try {
    return await command(rest, io);
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return exitCodes.failure;
  }
}
