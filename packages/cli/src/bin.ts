#!/usr/bin/env node
import { nodeFileSystem, nodeGit } from "@concordance-wiki/core";

import { clockFromEnvironment } from "./clock.js";
import { main } from "./main.js";

process.exitCode = await main(process.argv.slice(2), {
  fs: nodeFileSystem,
  git: nodeGit,
  clock: clockFromEnvironment(process.env),
  cwd: process.cwd(),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
