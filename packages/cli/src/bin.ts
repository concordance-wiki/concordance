#!/usr/bin/env node
import { nodeFileSystem } from "@concordance-wiki/core";

import { main } from "./main.js";

process.exitCode = main(process.argv.slice(2), {
  fs: nodeFileSystem,
  cwd: process.cwd(),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
