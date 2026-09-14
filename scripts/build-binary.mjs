// Builds the standalone binary of the command line as a Node.js single
// executable application. The built command line and its production
// dependencies are deployed by pnpm into a flat tree, packed into one
// compressed asset, and injected with the loader (sea-loader.cjs) into a copy
// of the Node.js executable. Run `pnpm build` first; the result is
// dist-bin/concordance-<platform>-<arch> with its SHA-256 next to it.
//
//   node scripts/build-binary.mjs [--output dist-bin] [--node /path/to/node] [--keep]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values: options } = parseArgs({
  options: {
    output: { type: "string", default: "dist-bin" },
    node: { type: "string", default: process.execPath },
    keep: { type: "boolean", default: false },
  },
});

const fuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const postject = "postject@1.0.0-alpha.6";
const skippedDirectories = new Set([".bin", ".pnpm", ".modules.yaml"]);
const skippedSuffixes = [".d.ts", ".d.ts.map", ".js.map"];

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    // What the command printed comes first: pnpm writes its own errors on stdout.
    process.stderr.write(result.stdout);
    throw new Error(`${[command, ...args].join(" ")} exited with ${String(result.status)}`);
  }
  return result.stdout;
}

// The script runs under `pnpm build:binary` (pnpm names itself in npm_execpath) or with pnpm on PATH.
function pnpm(args, cwd) {
  const execpath = process.env.npm_execpath;
  return execpath !== undefined && /pnpm/u.test(execpath)
    ? run(process.execPath, [execpath, ...args], cwd)
    : run("pnpm", args, cwd);
}

/** Forward-slash relative path to base64 content, sorted, for every file of the deployed tree the runtime needs. */
function archive(tree) {
  const files = {};
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      if (skippedDirectories.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (!skippedSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
        const path = relative(tree, absolute).replaceAll("\\", "/");
        files[path] = readFileSync(absolute).toString("base64");
      }
    }
  };
  walk(tree);
  return JSON.stringify({ files });
}

const entry = join(root, "packages/cli/dist/bin.js");
if (!existsSync(entry)) {
  console.error("build-binary: packages/cli/dist/bin.js is missing; run pnpm build first");
  process.exit(1);
}

const version = JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version;
const staging = mkdtempSync(join(tmpdir(), "concordance-binary-"));
try {
  const runtime = join(staging, "runtime");
  pnpm([
    "--filter",
    "@concordance-wiki/cli",
    "deploy",
    "--prod",
    "--legacy",
    "--config.node-linker=hoisted",
    runtime,
  ]);

  const json = archive(runtime);
  const id = `${version}-${createHash("sha256").update(json).digest("hex").slice(0, 16)}`;
  const assets = {
    "runtime.json.gz": join(staging, "runtime.json.gz"),
    "runtime.id": join(staging, "runtime.id"),
  };
  writeFileSync(assets["runtime.json.gz"], gzipSync(json, { level: 9 }));
  writeFileSync(assets["runtime.id"], id);

  const blob = join(staging, "sea-prep.blob");
  const config = join(staging, "sea-config.json");
  writeFileSync(
    config,
    JSON.stringify({
      main: join(root, "scripts/sea-loader.cjs"),
      output: blob,
      disableExperimentalSEAWarning: true,
      assets,
    }),
  );
  run(options.node, ["--experimental-sea-config", config]);

  const suffix = process.platform === "win32" ? ".exe" : "";
  const output = resolve(root, options.output);
  mkdirSync(output, { recursive: true });
  const binary = join(output, `concordance-${process.platform}-${process.arch}${suffix}`);
  copyFileSync(options.node, binary);
  chmodSync(binary, 0o755);
  if (process.platform === "darwin") run("codesign", ["--remove-signature", binary]);
  run("npx", [
    "--yes",
    postject,
    binary,
    "NODE_SEA_BLOB",
    blob,
    "--sentinel-fuse",
    fuse,
    ...(process.platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : []),
  ]);
  if (process.platform === "darwin") run("codesign", ["--sign", "-", binary]);

  const digest = createHash("sha256").update(readFileSync(binary)).digest("hex");
  writeFileSync(`${binary}.sha256`, `${digest}  ${relative(output, binary)}\n`);
  console.log(`${relative(root, binary)} (runtime ${id}, sha256 ${digest})`);
} finally {
  if (options.keep) console.log(`staging kept under ${staging}`);
  else rmSync(staging, { recursive: true, force: true });
}
