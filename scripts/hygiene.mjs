// Publication hygiene. Fails when the repository carries something that must
// never be published: an attribution trailer in a commit, an unexpected dot
// file or directory, an uppercase markdown file outside the governance set.
import { execFileSync } from "node:child_process";

const failures = [];

const allowedDotPaths = [/^\.github\//, /^\.changeset\//];
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

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
for (const path of tracked) {
  const segments = path.split("/");
  const base = segments[segments.length - 1];
  const dotSegment = segments.find((s) => s.startsWith(".") && s !== "." && s !== "..");
  if (dotSegment && !allowedDotPaths.some((re) => re.test(path)) && !allowedDotFiles.has(base)) {
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

const range = process.env.HYGIENE_COMMIT_RANGE ?? "HEAD~20..HEAD";
const commitMessages = (revisions) =>
  execFileSync("git", ["log", "--format=%H%n%B%n--end--", ...revisions], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
const readMessages = () => {
  try {
    return commitMessages([range]);
  } catch {
    try {
      return commitMessages([]);
    } catch {
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
  "no attribution trailer, no unexpected dot file, no unexpected uppercase markdown file",
);
