import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  parseModel,
  type ModelError,
  type CanonicalModel,
  type Config,
  type DomainConfig,
  type FileSystem,
  type PluginRegistry,
} from "@concordance-wiki/core";
import { glossarySources, languagePack, searchTokens } from "@concordance-wiki/nlp";
import type { Profile } from "@concordance-wiki/profile";
import {
  buildSite,
  fragmentImagePath,
  fragmentPath,
  parseFragment,
  type EntityFragment,
  type SiteNames,
} from "@concordance-wiki/site";

import { exitCodes, type CommandIo, type ExitCode } from "../io.js";
import { defaultOutputDirectory, loadProfile, modelFile } from "./build.js";
import { nodeThemeDependencies, siteTheme, type ThemeDependencies } from "./theme.js";
import { loadConfigFile } from "./validate-config.js";

export interface SiteRenderInput {
  config: Config;
  /** Absolute path of the configuration file. */
  configFile: string;
  profile: Profile;
  model: CanonicalModel;
  /** The folder holding `model.json` and `fragments/`. */
  modelDirectory: string;
  output: string;
  /** Who renders, `build` or `render`, for the messages. */
  command: string;
  /** The plugins the command already loaded, when it did. */
  registry?: PluginRegistry;
}

/** The titles the configuration gives to applications and domains, subdomains keyed by their id path. */
export function siteNames(config: Config): SiteNames {
  const applications: Record<string, string> = {};
  for (const application of config.applications ?? []) {
    applications[application.id] = application.title ?? application.id;
  }
  const domains: Record<string, string> = {};
  const walk = (list: readonly DomainConfig[], prefix: string): void => {
    for (const domain of list) {
      const id = `${prefix}${domain.id}`;
      domains[id] = domain.title ?? domain.id;
      walk(domain.subdomains ?? [], `${id}/`);
    }
  };
  walk(config.domains ?? [], "");
  return { applications, domains };
}

/** The fragments written next to the model, by entity; an entity without one renders without sections. */
export function readFragments(
  fs: FileSystem,
  modelDirectory: string,
  model: CanonicalModel,
): { fragments: Map<string, EntityFragment>; missing: number } {
  const fragments = new Map<string, EntityFragment>();
  let missing = 0;
  for (const entity of model.entities) {
    const file = join(modelDirectory, fragmentPath(entity.id));
    if (fs.exists(file)) {
      fragments.set(entity.id, parseFragment(fs.readText(file), file));
    } else {
      missing += 1;
    }
  }
  return { fragments, missing };
}

/** The `ref` of every git source that declares one, for the edit links of the pages. */
export function sourceRefs(config: Config): Record<string, string> {
  const refs: Record<string, string> = {};
  for (const source of config.sources) {
    if (source.ref !== undefined) {
      refs[source.name] = source.ref;
    }
  }
  return refs;
}

/**
 * Places the images of the notes next to their pages, from the copies the build kept under
 * `fragments/`; an image the build did not keep is skipped. Returns how many were placed.
 */
export function placeImages(
  fs: FileSystem,
  fragments: ReadonlyMap<string, EntityFragment>,
  modelDirectory: string,
  output: string,
): number {
  let placed = 0;
  for (const fragment of fragments.values()) {
    for (const image of fragment.images ?? []) {
      const from = join(modelDirectory, fragmentImagePath(image.target));
      if (!fs.exists(from)) continue;
      fs.writeBytes(join(output, image.target), fs.readBytes(from));
      placed += 1;
    }
  }
  return placed;
}

/**
 * Places the documents of the entities next to their pages, the original file and its PDF
 * preview, from the copies the build kept under `fragments/`; a file the build did not keep is
 * skipped. Returns how many files were placed.
 */
export function placeDocuments(
  fs: FileSystem,
  fragments: ReadonlyMap<string, EntityFragment>,
  modelDirectory: string,
  output: string,
): number {
  let placed = 0;
  for (const fragment of fragments.values()) {
    for (const document of fragment.documents ?? []) {
      const targets =
        document.preview === undefined || document.preview === document.target
          ? [document.target]
          : [document.target, document.preview];
      for (const target of targets) {
        const from = join(modelDirectory, fragmentImagePath(target));
        if (!fs.exists(from)) continue;
        fs.writeBytes(join(output, target), fs.readBytes(from));
        placed += 1;
      }
    }
  }
  return placed;
}

/**
 * Renders the site from a model and its fragments through the theme of the configuration, prints
 * the summary on stdout and every warning on stderr; a page over budget or with an accessibility
 * finding is reported, never a failure.
 */
export async function renderSite(
  io: CommandIo,
  deps: ThemeDependencies,
  input: SiteRenderInput,
): Promise<ExitCode> {
  const { config, command } = input;
  const theme = await siteTheme(io, deps, {
    config,
    file: input.configFile,
    command,
    ...(input.registry === undefined ? {} : { registry: input.registry }),
  });
  if ("exit" in theme) {
    return theme.exit;
  }
  const { fragments, missing } = readFragments(io.fs, input.modelDirectory, input.model);
  if (missing > 0) {
    io.err(
      `warning: ${String(missing)} entities have no fragment under ${input.modelDirectory}; their pages carry no note text`,
    );
  }
  const locale = config.project.locale ?? "en";
  const report = await buildSite({
    output: input.output,
    fileSystem: io.fs,
    model: input.model,
    fragments,
    profile: input.profile,
    theme,
    locale,
    collate: languagePack(locale).compare,
    projectName: config.project.name,
    names: siteNames(config),
    sourceRefs: sourceRefs(config),
    tokenize: (text, locale) => searchTokens(text, languagePack(locale)),
    glossarySources: [...glossarySources(config)],
    ...(config.project.edit_url === undefined ? {} : { editUrl: config.project.edit_url }),
    ...(config.build?.mentions_inline === undefined
      ? {}
      : { mentionsInline: config.build.mentions_inline }),
    ...(config.staleness === undefined ? {} : { staleness: config.staleness }),
    ...(config.build?.extracted_text_max_chars === undefined
      ? {}
      : { bodyMaxChars: config.build.extracted_text_max_chars }),
  });
  placeImages(io.fs, fragments, input.modelDirectory, input.output);
  placeDocuments(io.fs, fragments, input.modelDirectory, input.output);
  for (const line of report.summary) {
    io.out(line);
  }
  for (const line of report.warnings) {
    io.err(`warning: ${line}`);
  }
  return exitCodes.ok;
}

/** `concordance render`: the site again from an existing `model.json`, without touching the sources. */
export async function renderCommand(
  argv: string[],
  io: CommandIo,
  deps: ThemeDependencies = nodeThemeDependencies,
): Promise<ExitCode> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: "string", short: "c" },
      model: { type: "string", short: "m" },
      output: { type: "string", short: "o" },
    },
  });
  const loaded = loadConfigFile(io, values.config);
  if (loaded === undefined) {
    return exitCodes.failure;
  }
  if (!loaded.validation.ok) {
    io.err("render stopped: fix the configuration first");
    return exitCodes.invalid;
  }
  const config = loaded.validation.config;
  const configDirectory = dirname(loaded.file);
  const resolved = loadProfile(io, config, configDirectory);
  if (resolved === undefined) {
    io.err("render stopped: fix the profile first");
    return exitCodes.invalid;
  }
  const output =
    values.output === undefined
      ? resolve(configDirectory, config.build?.output ?? defaultOutputDirectory)
      : resolve(io.cwd, values.output);
  const file = values.model === undefined ? join(output, modelFile) : resolve(io.cwd, values.model);
  if (!io.fs.exists(file)) {
    io.err(`${file}: model not found; run concordance build first`);
    return exitCodes.failure;
  }
  let model: CanonicalModel;
  try {
    model = parseModel(io.fs.readText(file), file);
  } catch (error) {
    // parseModel only throws ModelError instances, one line per issue.
    for (const line of (error as ModelError).message.split("\n")) {
      io.err(line);
    }
    io.err("render stopped: the model does not match its schema");
    return exitCodes.invalid;
  }
  return renderSite(io, deps, {
    config,
    configFile: loaded.file,
    profile: resolved.profile,
    model,
    modelDirectory: dirname(file),
    output,
    command: "render",
  });
}
