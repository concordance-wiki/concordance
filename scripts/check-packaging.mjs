// What a published package ships, checked before it is packed: the manifest
// of every workspace package that is not private carries the fields a registry
// shows, its entry points and its `files` stay under the built and shipped
// folders, its licence is the one of the repository, and the tarball `pnpm
// pack --dry-run` would write holds neither tests, nor sources, nor fixtures.
// Run through scripts/validate.mjs; the pack itself is injectable for tests.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { publishedPackages } from "./release-notes.mjs";

const repositoryUrl = "git+https://github.com/concordance-wiki/concordance.git";
// The folders a manifest may list: the built code, the executables and the data read at run time.
const shippedFolders = new Set(["dist", "bin"]);
// What must never leave the repository, whatever the manifest lists.
const forbidden = [
  /^(src|test|tests|fixtures|coverage|reports|node_modules|\.stryker-tmp)(\/|$)/u,
  /(^|\/)tsconfig[^/]*\.json$/u,
  /\.tsbuildinfo$/u,
  /(^|\/)vitest\.config\.[^/]+$/u,
  /\.test\.[cm]?[jt]sx?$/u,
];
const required = ["package.json", "README.md", "LICENSE"];

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** The files `pnpm pack` would put in the tarball of the package at `dir`, as pnpm lists them. */
/**
 * The command that runs `pnpm`, as an absolute path — never a name looked up on the PATH: the pnpm
 * that runs this script, else the one of `PNPM_HOME`, else the corepack shipped next to node.
 */
export function pnpmCommand(env = process.env, execPath = process.execPath) {
  const running = env["npm_execpath"];
  if (running !== undefined && running.endsWith("pnpm.cjs")) return [execPath, running];
  const home = env["PNPM_HOME"];
  if (home !== undefined && existsSync(join(home, "pnpm"))) return [join(home, "pnpm")];
  return [join(dirname(execPath), "corepack"), "pnpm"];
}

export function packList(dir) {
  const [command, ...prefix] = pnpmCommand();
  const output = execFileSync(command, [...prefix, "pack", "--dry-run", "--json"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" },
  });
  return JSON.parse(output).files.map((file) => file.path);
}

/** Every file a manifest points at: the `bin` commands and the targets of the `exports` map, at any depth. */
export function entryPoints(manifest) {
  const targets = [];
  const collect = (value) => {
    if (typeof value === "string") targets.push(value);
    else if (isObject(value)) for (const inner of Object.values(value)) collect(inner);
  };
  collect(manifest.bin);
  collect(manifest.exports);
  collect(manifest.main);
  collect(manifest.types);
  return targets.sort(byCodeUnit);
}

/** The identity fields of a manifest: description, engines, access, repository, homepage, bugs. */
function checkIdentity(file, directory, manifest, fail) {
  if (typeof manifest.description !== "string" || manifest.description === "")
    fail(`${file}: description is missing`);
  if (typeof manifest.engines?.node !== "string") fail(`${file}: engines.node is missing`);
  if (manifest.publishConfig?.access !== "public")
    fail(`${file}: publishConfig.access must be public`);
  const repository = manifest.repository;
  if (repository?.type !== "git" || repository.url !== repositoryUrl)
    fail(`${file}: repository must be ${repositoryUrl}`);
  else if (repository.directory !== directory)
    fail(`${file}: repository.directory must be ${directory}`);
  if (typeof manifest.homepage !== "string" || !manifest.homepage.startsWith("https://"))
    fail(`${file}: homepage is missing`);
  if (typeof manifest.bugs !== "string" || !manifest.bugs.startsWith("https://"))
    fail(`${file}: bugs is missing`);
}

/** The `files` list: the readme and the licence, a shipped folder, nothing forbidden, nothing missing. */
function checkFiles(file, dir, manifest, fail) {
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!Array.isArray(manifest.files)) fail(`${file}: files is missing`);
  for (const name of ["README.md", "LICENSE"]) {
    if (!files.includes(name)) fail(`${file}: files must list ${name}`);
  }
  if (!files.some((entry) => shippedFolders.has(entry)))
    fail(`${file}: files must list dist or bin`);
  for (const entry of files) {
    if (forbidden.some((pattern) => pattern.test(entry)))
      fail(`${file}: files must not list ${entry}`);
    else if (entry !== "dist" && !existsSync(join(dir, entry)))
      fail(`${file}: files lists ${entry}, which does not exist`);
  }
  return files;
}

/** Every entry point under a shipped folder, listed in `files`, present once the folder is built. */
function checkEntryPoints(file, dir, manifest, files, fail) {
  for (const target of entryPoints(manifest)) {
    const [dot, folder] = target.split("/");
    if (dot !== "." || folder === undefined || !shippedFolders.has(folder)) {
      fail(`${file}: entry point ${target} is not under dist or bin`);
    } else if (!files.includes(folder)) {
      fail(`${file}: entry point ${target} is outside the files list`);
    } else if (existsSync(join(dir, folder)) && !existsSync(join(dir, target))) {
      fail(`${file}: entry point ${target} does not exist`);
    }
  }
}

/** The licence of a package is the one of the repository, byte for byte. */
function checkLicence(root, directory, dir, fail) {
  const licence = join(dir, "LICENSE");
  if (!existsSync(licence)) fail(`${directory}/LICENSE: missing, copy the one of the repository`);
  else if (readFileSync(licence, "utf8") !== readFileSync(join(root, "LICENSE"), "utf8"))
    fail(`${directory}/LICENSE: differs from the one of the repository`);
}

function checkManifest(root, pkg, manifest, fail) {
  const directory = relative(root, pkg.dir);
  const file = `${directory}/package.json`;
  checkIdentity(file, directory, manifest, fail);
  const files = checkFiles(file, pkg.dir, manifest, fail);
  checkEntryPoints(file, pkg.dir, manifest, files, fail);
  checkLicence(root, directory, pkg.dir, fail);
}

function checkTarball(root, pkg, files, fail) {
  const directory = relative(root, pkg.dir);
  for (const name of required) {
    if (!files.includes(name)) fail(`${directory}: the tarball lacks ${name}`);
  }
  for (const path of [...files].sort(byCodeUnit)) {
    if (forbidden.some((pattern) => pattern.test(path)))
      fail(`${directory}: the tarball would ship ${path}`);
  }
}

/** The failure messages of every published package; an empty list when they are all ready to publish. */
export function checkPackaging(root, pack = packList) {
  const failures = [];
  const fail = (message) => failures.push(message);
  for (const pkg of publishedPackages(root)) {
    const manifest = JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf8"));
    checkManifest(root, pkg, manifest, fail);
    checkTarball(root, pkg, pack(pkg.dir), fail);
  }
  return failures;
}
