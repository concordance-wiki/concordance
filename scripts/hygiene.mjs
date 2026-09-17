// Publication hygiene. Fails when the repository carries something that must
// never be published: an attribution trailer in a commit, an unexpected dot
// file or directory, an uppercase markdown file outside the governance set.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { systemCommand } from "./executables.mjs";

const failures = [];

// Under `.github/`, the templates and the workflows alone: no instruction file for any assistant, no agent folder.
const allowedDotPaths = [
  /^\.github\/(?:CODEOWNERS|PULL_REQUEST_TEMPLATE\.md|dependabot\.yml|ISSUE_TEMPLATE\/[^/]+\.ya?ml|workflows\/[^/]+\.ya?ml)$/,
  /^\.changeset\//,
];
const allowedDotFiles = new Set([
  ".gitignore",
  ".nvmrc",
  ".editorconfig",
  ".prettierrc",
  ".prettierignore",
  ".npmrc",
  ".gitkeep",
  ".dockerignore",
  // The pre-commit hook manifest; pre-commit reads it at the root of the repository named by `repo:`.
  ".pre-commit-hooks.yaml",
]);
const allowedUppercaseMarkdown = new Set([
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "LICENSE.md",
  "PULL_REQUEST_TEMPLATE.md",
]);
const checkPage = /^docs\/checks\/[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*\.md$/;

const GIT = systemCommand("git");
const tracked = execFileSync(GIT, ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
for (const path of tracked) {
  const segments = path.split("/");
  const base = segments[segments.length - 1];
  const dotted = segments.some((s) => s.startsWith(".") && s !== "." && s !== "..");
  if (dotted && !allowedDotPaths.some((re) => re.test(path)) && !allowedDotFiles.has(base)) {
    failures.push(`unexpected dot file or directory: ${path}`);
  }
  if (
    /^[A-Z][A-Z_-]+\.md$/.test(base) &&
    !allowedUppercaseMarkdown.has(base) &&
    !checkPage.test(path)
  ) {
    failures.push(`unexpected uppercase markdown file: ${path}`);
  }
}

// Secrets by their shape: a token of a forge or a registry, a private key, credentials in a URL.
const secretPatterns = [
  { name: "a GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u },
  { name: "a GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/u },
  { name: "a GitLab token", pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/u },
  { name: "an npm token", pattern: /\bnpm_[A-Za-z0-9]{36,}\b/u },
  { name: "a private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u },
  { name: "an AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/u },
  // A literal password after the user; `${VAR}` is a placeholder the pipeline fills, not a secret.
  {
    name: "credentials in a URL",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:(?!\$\{)[^\s/@]+@/iu,
  },
];

// Words and identifiers of the steering repository, or of a domain the examples left behind, never published.
const bannedMarkers = [
  { name: "a decision identifier", pattern: /\bADR-\d/u },
  // The specification numbers its own stories: the only file where such an identifier is public by design.
  { name: "a story identifier", pattern: /\bL\d{1,2}-\d{2,3}\b/u, except: ["docs/spec/mvp.md"] },
  { name: "a word of the former example domain", pattern: /\bversement\b/iu },
];
const scannedExtensions = /\.(md|html|ts|tsx|mjs|js|yaml|yml|json|txt|css)$/u;
for (const path of tracked) {
  if (!scannedExtensions.test(path) || !existsSync(path)) continue;
  const text = readFileSync(path, "utf8");
  for (const marker of bannedMarkers) {
    if (marker.except?.includes(path)) continue;
    if (marker.pattern.test(text)) failures.push(`${path} carries ${marker.name}`);
  }
  for (const secret of secretPatterns) {
    if (secret.pattern.test(text)) failures.push(`${path} carries ${secret.name}`);
  }
}

const range = process.env.HYGIENE_COMMIT_RANGE ?? "HEAD~20..HEAD";
const commitMessages = (revisions) =>
  execFileSync(GIT, ["log", "--format=%H%n%B%n--end--", ...revisions], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
// The range of the run, else every commit the clone holds; a log that cannot be read is a failure, never a pass.
const readMessages = () => {
  try {
    return commitMessages([range]);
  } catch {
    try {
      return commitMessages([]);
    } catch {
      failures.push(`git log could not be read: the commit messages were not checked`);
      return "";
    }
  }
};
const messages = readMessages();
for (const block of messages.split("--end--")) {
  const lines = block.trim().split("\n");
  if (lines.length < 2) continue;
  const hash = lines[0].slice(0, 12);
  for (const line of lines.slice(1)) {
    if (/^(Co-Authored-By|Generated-by|Signed-off-by-bot):/i.test(line.trim())) {
      failures.push(`commit ${hash} carries an attribution trailer`);
    }
  }
}

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  process.exit(1);
}
console.log(
  "no attribution trailer, no unexpected dot file, no unexpected uppercase markdown file, no banned marker, no secret",
);
