import { dirname, resolve } from "node:path";

import { formatIssue, type FileSystem, type PluginRegistry } from "@concordance-wiki/core";
import {
  readTypeModule,
  readTypeModules,
  typesDirectoryOf,
  type TypeModule,
} from "@concordance-wiki/profile";

import type { CommandIo } from "../io.js";

/** Where the modules of the plugins are read from, injected so that tests run against doubles. */
export interface TypeModuleDependencies {
  /** Absolute folder of a plugin package; absent, the type modules of the plugins are left aside. */
  rootOf?: (plugin: string) => string;
  /** Reads the files of plugin packages, which live where their modules are imported from. */
  pluginFiles?: FileSystem;
}

/**
 * The type modules of the plugins of the registry, in registration order, each read from its
 * package; every problem is printed with the folder it comes from, and nothing is returned then.
 */
export function pluginTypeModules(
  io: CommandIo,
  registry: PluginRegistry,
  deps: TypeModuleDependencies,
): TypeModule[] | undefined {
  const { rootOf } = deps;
  if (rootOf === undefined) {
    return [];
  }
  const files = deps.pluginFiles ?? io.fs;
  const modules: TypeModule[] = [];
  let failed = false;
  for (const contribution of registry.types()) {
    const directory = resolve(rootOf(contribution.plugin), contribution.path);
    const reading = readTypeModule(files, directory);
    if (reading.ok) {
      modules.push({ ...reading.module, origin: contribution.plugin });
      continue;
    }
    failed = true;
    for (const issue of reading.issues) {
      io.err(formatIssue(issue, `plugin ${contribution.plugin}, ${directory}`));
    }
  }
  return failed ? undefined : modules;
}

/**
 * The type modules of the folder a project profile names under `types_dir`, resolved against
 * the profile file; none without the key. Problems are printed with their folder, and nothing
 * is returned then.
 */
export function projectTypeModules(
  io: CommandIo,
  profileFile: string,
  profileText: string,
): TypeModule[] | undefined {
  const named = typesDirectoryOf(profileText);
  if (named === undefined) {
    return [];
  }
  const directory = resolve(dirname(profileFile), named);
  if (!io.fs.exists(directory)) {
    io.err(`${profileFile}: types_dir: folder not found: ${directory}`);
    return undefined;
  }
  const reading = readTypeModules(io.fs, directory);
  for (const issue of reading.issues) {
    io.err(formatIssue(issue, directory));
  }
  return reading.issues.length === 0 ? reading.modules : undefined;
}
