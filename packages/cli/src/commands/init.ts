import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  formatIssue,
  loadPlugins,
  parseConfig,
  type PluginLoaderDependencies,
} from "@concordance-wiki/core";
import type { TypeModule } from "@concordance-wiki/profile";
import { defaultThemeManifest } from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { templatesDirectory } from "../templates.js";
import { formatFinding } from "./findings.js";
import { nodeThemeDependencies, specifier } from "./theme.js";
import { pluginTypeModules, type TypeModuleDependencies } from "./types.js";
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

# Global business domains, resolved by a folder name or by globs across every source.
# domains:
#   - id: publication
#     folder: true
#     match: ["**/*page*"]

build:
  output: ./dist
`;

/** Folder of the configuration repository that receives the note templates under `--templates`. */
export const templatesFolder = "templates";

/** Module loading, injected so that tests read the type modules of the plugins against doubles. */
export type InitDependencies = PluginLoaderDependencies & TypeModuleDependencies;

/** One template to write: its file name under `templates/` and its content. */
interface Template {
  name: string;
  content: string;
}

/** The shipped templates in name order, then the template of every type the plugins contribute. */
function templatesToWrite(
  io: CommandIo,
  templates: string,
  modules: readonly TypeModule[],
): Template[] {
  const shipped = io.fs
    .listFiles(templates)
    .map((name) => ({ name, content: io.fs.readText(resolve(templates, name)) }));
  const contributed = modules.flatMap((module) =>
    module.template === undefined ? [] : [{ name: `${module.slug}.md`, content: module.template }],
  );
  return [...shipped, ...contributed];
}

/** Writes every template that does not exist yet; an existing file is kept and reported. */
function writeTemplates(directory: string, io: CommandIo, templates: Template[]): ExitCode {
  let code: ExitCode = exitCodes.ok;
  for (const { name, content } of templates) {
    const file = resolve(directory, templatesFolder, name);
    if (io.fs.exists(file)) {
      io.err(`${file}: already exists, kept`);
      code = exitCodes.failure;
      continue;
    }
    io.fs.writeText(file, content);
    io.out(`${file}: written`);
  }
  return code;
}

/**
 * The type modules of the plugins the configuration file declares, read from their packages;
 * undefined, with the reasons printed, when the configuration or a module is invalid.
 */
async function contributedModules(
  io: CommandIo,
  file: string,
  deps: InitDependencies,
): Promise<TypeModule[] | undefined> {
  const validation = parseConfig(io.fs.readText(file));
  if (!validation.ok) {
    for (const issue of validation.issues) {
      io.err(formatIssue(issue, file));
    }
    return undefined;
  }
  const { registry, findings } = await loadPlugins(validation.config.plugins ?? [], {
    load: (name) => deps.load(specifier(name, dirname(file))),
    commandAvailable: deps.commandAvailable,
    builtin: [defaultThemeManifest()],
  });
  for (const finding of findings) {
    io.err(formatFinding(finding));
  }
  return pluginTypeModules(io, registry, deps);
}

/**
 * `concordance init [directory] [--templates]`: writes a minimal configuration, and with
 * `--templates` the note templates of the core types and of the types contributed by the plugins
 * the configuration declares. An existing configuration is kept; without `--templates` nothing
 * else is written then.
 */
export async function initCommand(
  argv: string[],
  io: CommandIo,
  templates: string = templatesDirectory(),
  deps: InitDependencies = nodeThemeDependencies,
): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { templates: { type: "boolean", default: false } },
    allowPositionals: true,
  });
  const directory = resolve(io.cwd, positionals[0] ?? ".");
  const file = resolve(directory, defaultConfigFile);
  let code: ExitCode = exitCodes.ok;
  if (io.fs.exists(file)) {
    if (!values.templates) {
      io.err(`${file}: already exists, nothing written`);
      return exitCodes.failure;
    }
    io.err(`${file}: already exists, kept`);
    code = exitCodes.failure;
  } else {
    io.fs.writeText(file, initialConfig);
    io.out(`${file}: written`);
  }
  if (!values.templates) {
    return code;
  }
  const modules = await contributedModules(io, file, deps);
  if (modules === undefined) {
    return exitCodes.failure;
  }
  const written = writeTemplates(directory, io, templatesToWrite(io, templates, modules));
  return written === exitCodes.ok ? code : written;
}
