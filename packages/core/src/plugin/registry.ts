import type { PluginConfig } from "../config/types.js";
import { compareFindings, type Finding } from "../model/finding.js";
import {
  PLUGIN_API_VERSION,
  type CheckContribution,
  type Converter,
  type InferenceMethod,
  type PluginManifest,
  type Projection,
  type Reader,
  type SourceProvider,
  type ThemeContribution,
  type UiComponent,
} from "./api.js";
import { isPluginManifest } from "./define.js";

export class PluginLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginLoadError";
  }
}

export interface PluginRegistration {
  name: string;
  manifest: PluginManifest;
  /** Options declared in the configuration; no contribution reads them yet. */
  options: Record<string, unknown>;
}

export interface PluginRegistry {
  /** Names of the registered plugins, in declaration order. */
  plugins: () => string[];
  registrations: () => PluginRegistration[];
  readers: () => Reader[];
  converters: () => Converter[];
  sources: () => SourceProvider[];
  inferenceMethods: () => InferenceMethod[];
  checks: () => CheckContribution[];
  projections: () => Projection[];
  uiComponents: () => UiComponent[];
  themes: () => ThemeContribution[];
}

export interface PluginLoaderDependencies {
  /** Resolves a package name to its default export. */
  load: (packageName: string) => Promise<unknown>;
  commandAvailable: (command: string) => Promise<boolean>;
  /**
   * Manifests registered before the declared plugins without being loaded: the contributions the
   * tool ships itself, the UI components of the default theme for instance. They claim their
   * keys like any plugin, so a declared plugin cannot take them over silently.
   */
  builtin?: readonly PluginManifest[];
}

export interface LoadedPlugins {
  registry: PluginRegistry;
  findings: Finding[];
}

function declared(declaration: PluginConfig): { name: string; options: Record<string, unknown> } {
  return typeof declaration === "string"
    ? { name: declaration, options: {} }
    : { name: declaration.name, options: declaration.options ?? {} };
}

function manifestOf(loaded: unknown, packageName: string): PluginManifest {
  if (!isPluginManifest(loaded)) {
    throw new PluginLoadError(
      `plugin ${packageName}: the default export is not a manifest returned by definePlugin`,
    );
  }
  if (loaded.apiVersion !== PLUGIN_API_VERSION) {
    throw new PluginLoadError(
      `plugin ${packageName}: targets plugin API version ${loaded.apiVersion}; this core provides version ${PLUGIN_API_VERSION}`,
    );
  }
  return loaded;
}

/** Reports every missing dependency; the plugin stays enabled when only optional ones are missing. */
async function missingDependencies(
  manifest: PluginManifest,
  commandAvailable: (command: string) => Promise<boolean>,
): Promise<{ enabled: boolean; findings: Finding[] }> {
  let enabled = true;
  const findings: Finding[] = [];
  for (const dependency of manifest.systemDependencies ?? []) {
    if (await commandAvailable(dependency.check)) {
      continue;
    }
    const optional = dependency.optional === true;
    enabled = enabled && optional;
    findings.push({
      check: "W-PLUGIN-DISABLED",
      severity: optional ? "info" : "warning",
      message: optional
        ? `plugin ${manifest.name} runs without its optional system dependency ${dependency.name}: command ${dependency.check} is not available`
        : `plugin ${manifest.name} is disabled: its system dependency ${dependency.name} is missing, command ${dependency.check} is not available`,
      remediation: `install ${dependency.name} so that ${dependency.check} is on the PATH, or remove the plugin from concordance.yaml`,
    });
  }
  return { enabled, findings };
}

/** Every contribution key a plugin claims, as "<point> <key>" labels. */
function claimsOf(manifest: PluginManifest): string[] {
  const { contributes } = manifest;
  return [
    ...(contributes.readers ?? []).flatMap((r) => r.extensions.map((e) => `reader extension ${e}`)),
    ...(contributes.converters ?? []).flatMap((c) =>
      c.extensions.map((e) => `converter extension ${e}`),
    ),
    ...(contributes.sources ?? []).map((s) => `source kind ${s.kind}`),
    ...(contributes.inferenceMethods ?? []).map((m) => `inference method ${m.method}`),
    ...(contributes.checks ?? []).map((c) => `check ${c.id}`),
    ...(contributes.projections ?? []).map((p) => `projection ${p.id}`),
    ...(contributes.uiComponents ?? []).map((u) => `ui slot ${u.slot}`),
    ...(contributes.themes ?? []).map((t) => `theme ${t.name}`),
  ];
}

function claim(manifest: PluginManifest, claimed: Map<string, string>): void {
  for (const label of claimsOf(manifest)) {
    const owner = claimed.get(label);
    if (owner !== undefined) {
      throw new PluginLoadError(
        `plugin ${manifest.name}: ${label} is already contributed by ${owner}`,
      );
    }
    claimed.set(label, manifest.name);
  }
}

function createRegistry(registered: PluginRegistration[]): PluginRegistry {
  const collect = <T>(select: (manifest: PluginManifest) => T[] | undefined): T[] =>
    registered.flatMap((registration) => select(registration.manifest) ?? []);
  return {
    plugins: () => registered.map((registration) => registration.name),
    registrations: () => [...registered],
    readers: () => collect((manifest) => manifest.contributes.readers),
    converters: () => collect((manifest) => manifest.contributes.converters),
    sources: () => collect((manifest) => manifest.contributes.sources),
    inferenceMethods: () => collect((manifest) => manifest.contributes.inferenceMethods),
    checks: () => collect((manifest) => manifest.contributes.checks),
    projections: () => collect((manifest) => manifest.contributes.projections),
    uiComponents: () => collect((manifest) => manifest.contributes.uiComponents),
    themes: () => collect((manifest) => manifest.contributes.themes),
  };
}

export async function loadPlugins(
  declarations: PluginConfig[],
  deps: PluginLoaderDependencies,
): Promise<LoadedPlugins> {
  const registered: PluginRegistration[] = [];
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const claimed = new Map<string, string>();
  for (const manifest of deps.builtin ?? []) {
    seen.add(manifest.name);
    claim(manifest, claimed);
    registered.push({ name: manifest.name, manifest, options: {} });
  }
  for (const declaration of declarations) {
    const { name, options } = declared(declaration);
    const manifest = manifestOf(await deps.load(name), name);
    if (seen.has(manifest.name)) {
      throw new PluginLoadError(`plugin ${manifest.name}: declared more than once`);
    }
    seen.add(manifest.name);
    const missing = await missingDependencies(manifest, deps.commandAvailable);
    findings.push(...missing.findings);
    if (!missing.enabled) {
      continue;
    }
    claim(manifest, claimed);
    registered.push({ name: manifest.name, manifest, options });
  }
  return { registry: createRegistry(registered), findings: findings.sort(compareFindings) };
}
