import { posix } from "node:path";

import { compileGlobs, type SourceConfig, type TypingRuleMatch } from "@concordance-wiki/core";

export interface DeduceTypeInput {
  /** Forward-slash path of the file, relative to the repository root. */
  path: string;
  /** The parsed frontmatter, for rules matching on the presence of a key. */
  frontmatter: Record<string, unknown>;
  source: SourceConfig | undefined;
}

/** Every criterion written in the rule must hold. */
function matches(match: TypingRuleMatch, input: DeduceTypeInput): boolean {
  return (
    (match.path === undefined || compileGlobs([match.path])(input.path)) &&
    (match.suffix === undefined || input.path.endsWith(match.suffix)) &&
    (match.ext === undefined || match.ext.includes(posix.extname(input.path))) &&
    (match.frontmatter === undefined || match.frontmatter in input.frontmatter)
  );
}

/**
 * The type the source configuration gives a file, by increasing precedence: `default_type`, `type`,
 * then the rules in order, the last match winning. Nothing is deduced without a declared source, and
 * the implicit `document` default is never written.
 */
export function deduceType(input: DeduceTypeInput): string | undefined {
  const { source } = input;
  if (source === undefined) return undefined;
  let type = source.type ?? source.default_type;
  for (const rule of source.rules ?? []) {
    const set = rule.set["type"];
    if (typeof set === "string" && matches(rule.match, input)) {
      type = set;
    }
  }
  return type;
}
