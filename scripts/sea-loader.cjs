// Main script of the standalone binary. Node.js runs it as CommonJS with a
// require() limited to builtin modules, so the deployed command line travels
// as a compressed asset of the executable: it is unpacked once per build into
// the user's cache, then its bin.js receives the arguments through a dynamic
// import, exactly as the npm package would.
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sea = require("node:sea");
const { pathToFileURL } = require("node:url");
const zlib = require("node:zlib");

function cacheRoot() {
  const configured = process.env.CONCORDANCE_RUNTIME_DIR;
  if (configured !== undefined && configured !== "") return configured;
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "concordance", "runtime");
}

function unpack(target) {
  const archive = JSON.parse(
    zlib.gunzipSync(Buffer.from(sea.getAsset("runtime.json.gz"))).toString("utf8"),
  );
  // Unpacked next to the target, then renamed, so that a concurrent run never sees a partial tree.
  const staging = `${target}.${String(process.pid)}`;
  fs.rmSync(staging, { recursive: true, force: true });
  for (const [relative, content] of Object.entries(archive.files)) {
    const file = path.join(staging, ...relative.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(content, "base64"));
  }
  try {
    fs.renameSync(staging, target);
  } catch (error) {
    if (!fs.existsSync(target)) throw error;
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

const id = Buffer.from(sea.getAsset("runtime.id")).toString("utf8");
const runtime = path.join(cacheRoot(), id);
const entry = path.join(runtime, "dist", "bin.js");
if (!fs.existsSync(entry)) unpack(runtime);
import(pathToFileURL(entry).href).catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 2;
});
