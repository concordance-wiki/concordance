import { parseArgs } from "node:util";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { Server } from "../mcp/protocol.js";

/**
 * Serves the questions of `query` to an agent over the standard input, as tools of the model
 * context protocol: one message per line in, one per line out, nothing else on the standard
 * output. The model is the one `query` would read, or the one `--model` names; every call reads it again.
 */
export async function mcpCommand(argv: string[], io: CommandIo): Promise<ExitCode> {
  const { values } = parseArgs({
    args: argv,
    options: { model: { type: "string", short: "m" }, config: { type: "string", short: "c" } },
  });
  if (io.input === undefined) {
    io.err("mcp reads its requests on the standard input; none is open");
    return exitCodes.failure;
  }
  const model = [
    ...(values.model === undefined ? [] : ["--model", values.model]),
    ...(values.config === undefined ? [] : ["--config", values.config]),
  ];
  const server = new Server(io, model);
  for await (const line of io.input) {
    const response = await server.handle(line);
    if (response !== undefined) io.out(JSON.stringify(response));
  }
  return exitCodes.ok;
}
