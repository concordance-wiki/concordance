import { compileGlobs, type DomainConfig, type PathMatcher } from "@concordance-wiki/core";

import { declaredString } from "./frontmatter.js";

/** The domain of every note that no declared domain claims. */
export const UNCLASSIFIED_DOMAIN = "unclassified";

export interface CompiledDomain {
  id: string;
  /** The identifiers from the root domain down to this one, `inference/recognition` style. */
  path: string;
  /** Zero for a root domain. */
  depth: number;
  matcher: PathMatcher;
}

/** The domain tree flattened in declaration order, each parent before its subdomains. */
export type DomainMatcher = readonly CompiledDomain[];

export type DomainOrigin = "frontmatter" | "glob" | "unclassified";

export interface ResolvedDomain {
  /** The full identifier path of the domain, or `unclassified`. */
  domain: string;
  origin: DomainOrigin;
  /** False only for a frontmatter domain that no declared domain answers to. */
  declared: boolean;
}

function flatten(
  domains: readonly DomainConfig[],
  parent: string,
  depth: number,
): CompiledDomain[] {
  return domains.flatMap((domain) => {
    const path = parent === "" ? domain.id : `${parent}/${domain.id}`;
    return [
      { id: domain.id, path, depth, matcher: compileGlobs(domain.match ?? []) },
      ...flatten(domain.subdomains ?? [], path, depth + 1),
    ];
  });
}

export function compileDomains(domains: readonly DomainConfig[]): DomainMatcher {
  return flatten(domains, "", 0);
}

/** A frontmatter value names a domain by its full path first, else by the identifier of the first domain declared with it. */
function declaredDomain(value: string, domains: DomainMatcher): CompiledDomain | undefined {
  return (
    domains.find((domain) => domain.path === value) ?? domains.find((domain) => domain.id === value)
  );
}

/** Among the domains whose globs match, the deepest wins; between domains of the same depth, the last declared. */
function matchingDomain(relativePath: string, domains: DomainMatcher): CompiledDomain | undefined {
  let best: CompiledDomain | undefined;
  for (const domain of domains) {
    if (!domain.matcher(relativePath)) continue;
    if (best === undefined || domain.depth >= best.depth) best = domain;
  }
  return best;
}

/**
 * Decreasing precedence: the frontmatter `domain`, the globs evaluated on the source-relative
 * path, then `unclassified`.
 */
export function resolveDomain(
  relativePath: string,
  frontmatterDomain: unknown,
  domains: DomainMatcher,
): ResolvedDomain {
  const declared = declaredString(frontmatterDomain);
  if (declared !== undefined) {
    const found = declaredDomain(declared, domains);
    if (found !== undefined) return { domain: found.path, origin: "frontmatter", declared: true };
    return { domain: declared, origin: "frontmatter", declared: declared === UNCLASSIFIED_DOMAIN };
  }
  const matched = matchingDomain(relativePath, domains);
  if (matched !== undefined) return { domain: matched.path, origin: "glob", declared: true };
  return { domain: UNCLASSIFIED_DOMAIN, origin: "unclassified", declared: true };
}
