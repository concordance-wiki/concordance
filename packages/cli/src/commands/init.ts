import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { templatesDirectory } from "../templates.js";
import { defaultConfigFile } from "./validate-config.js";

export const initialConfig = `# Concordance configuration. Reference: docs/guides/configuration.md
version: 1

project:
  name: My wiki
  # Interface language and default locale of the sources: en or fr.
  locale: en

# Sources are git repositories (git: + ref:) or local folders (path:).
# Everything is optional beyond name and git or path: without rules, every
# markdown file becomes a document and every word gets a page.
sources:
  - name: notes
    path: ./notes
    # rules:
    #   - match: { path: "screens/**" }
    #     set: { type: screen }
    #   - match: { suffix: ".rule.md" }
    #     set: { type: rule }

# Global business domains, resolved by globs across every source.
# domains:
#   - id: payments
#     match: ["**/payment*"]

build:
  output: ./dist
`;

/** Folder of the configuration repository that receives the note templates under `--templates`. */
export const templatesFolder = "templates";

/** Copies every shipped template that does not exist yet; an existing file is kept and reported. */
function writeTemplates(directory: string, io: CommandIo, templates: string): ExitCode {
  let code: ExitCode = exitCodes.ok;
  for (const name of io.fs.listFiles(templates)) {
    const file = resolve(directory, templatesFolder, name);
    if (io.fs.exists(file)) {
      io.err(`${file}: already exists, kept`);
      code = exitCodes.failure;
      continue;
    }
    io.fs.writeText(file, io.fs.readText(resolve(templates, name)));
    io.out(`${file}: written`);
  }
  return code;
}

export function initCommand(
  argv: string[],
  io: CommandIo,
  templates: string = templatesDirectory(),
): ExitCode {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { templates: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  const directory = resolve(io.cwd, positionals[0] ?? ".");
  const file = resolve(directory, defaultConfigFile);
  if (io.fs.exists(file)) {
    io.err(`${file}: already exists, nothing written`);
    return exitCodes.failure;
  }
  io.fs.writeText(file, initialConfig);
  io.out(`${file}: written`);
  return values.templates ? writeTemplates(directory, io, templates) : exitCodes.ok;
}
