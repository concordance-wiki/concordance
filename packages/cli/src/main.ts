import { buildCommand } from "./commands/build.js";
import { initCommand } from "./commands/init.js";
import { validateConfigCommand } from "./commands/validate-config.js";
import { exitCodes, type CommandIo, type ExitCode } from "./io.js";

type Command = (argv: string[], io: CommandIo) => ExitCode | Promise<ExitCode>;

const commands: Record<string, Command> = {
  build: buildCommand,
  init: initCommand,
  "validate-config": validateConfigCommand,
};

export const usage = [
  "usage: concordance <command> [options]",
  "",
  "commands:",
  "  build [--config file] [--output dir]  validate the configuration and build the site",
  "  init [directory]                      write a minimal configuration file",
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
  const command = commands[name];
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
