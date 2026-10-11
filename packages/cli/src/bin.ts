#!/usr/bin/env node
import { createInterface, type Interface } from "node:readline";

import { nodeFileSystem, nodeGit } from "@concordance-wiki/core";

import { clockFromEnvironment } from "./clock.js";
import { main } from "./main.js";

// Opened on first read. Only `concordance mcp` serves a protocol over its standard input, and an
// open readline interface keeps the process alive until that input ends: opened for every
// command, it kept `lint` or `build` running forever under a caller that left its input open.
let lines: Interface | undefined;

process.exitCode = await main(process.argv.slice(2), {
  fs: nodeFileSystem,
  git: nodeGit,
  clock: clockFromEnvironment(process.env),
  fetch: (input, init) => fetch(input, init),
  cwd: process.cwd(),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  get input() {
    lines ??= createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
    return lines;
  },
});
