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
  /** True when the domain declares at least one glob. */
  globs: boolean;
  /** The name of the folder that claims files, absent for a domain declared by globs or frontmatter alone. */
  folder?: string;
  parent?: CompiledDomain;
}

/** The domain tree flattened in declaration order, each parent before its subdomains. */
export type DomainMatcher = readonly CompiledDomain[];

export type DomainOrigin = "frontmatter" | "folder" | "glob" | "unclassified";

export interface ResolvedDomain {
  /** The full identifier path of the domain, or `unclassified`. */
  domain: string;
  origin: DomainOrigin;
  /** False only for a frontmatter domain that no declared domain answers to. */
  declared: boolean;
}

function folderOf(domain: DomainConfig): string | undefined {
  if (domain.folder === true) return domain.id;
  if (typeof domain.folder === "string") return domain.folder;
  return undefined;
}

function flatten(
  domains: readonly DomainConfig[],
  parent: CompiledDomain | undefined,
  depth: number,
): CompiledDomain[] {
  return domains.flatMap((domain) => {
    const path = parent === undefined ? domain.id : `${parent.path}/${domain.id}`;
    const globs = domain.match ?? [];
    const folder = folderOf(domain);
    const compiled: CompiledDomain = {
      id: domain.id,
      path,
      depth,
      matcher: compileGlobs(globs),
      globs: globs.length > 0,
      ...(folder === undefined ? {} : { folder }),
      ...(parent === undefined ? {} : { parent }),
    };
    return [compiled, ...flatten(domain.subdomains ?? [], compiled, depth + 1)];
  });
}

export function compileDomains(domains: readonly DomainConfig[]): DomainMatcher {
  return flatten(domains, undefined, 0);
}

/** A frontmatter value names a domain by its full path first, else by the identifier of the first domain declared with it. */
function declaredDomain(value: string, domains: DomainMatcher): CompiledDomain | undefined {
  return (
    domains.find((domain) => domain.path === value) ?? domains.find((domain) => domain.id === value)
  );
}

/** The directory segments of a source-relative path, the file name excluded. */
function directoriesOf(relativePath: string): string[] {
  return relativePath.split("/").slice(0, -1);
}

/**
 * The positions, among the directory segments, where the folder of the domain sits; none for
 * a domain without folder. A subdomain's folder counts only under its parent's folder; when
 * the parent is declared by globs instead, it counts anywhere on a path the parent's globs
 * match; a parent declared by neither constrains nothing.
 */
function folderPositions(
  domain: CompiledDomain,
  directories: readonly string[],
  relativePath: string,
): number[] {
  const own = directories.flatMap((segment, index) => (segment === domain.folder ? [index] : []));
  const { parent } = domain;
  if (parent === undefined) return own;
  if (parent.folder !== undefined) {
    const first = Math.min(...folderPositions(parent, directories, relativePath));
    return own.filter((index) => index > first);
  }
  return !parent.globs || parent.matcher(relativePath) ? own : [];
}

interface Claim {
  domain: CompiledDomain;
  origin: "folder" | "glob";
}

/** How a domain claims a file, its folder before its globs; undefined when it does not. */
function claimOf(
  domain: CompiledDomain,
  relativePath: string,
  directories: readonly string[],
): Claim | undefined {
  if (folderPositions(domain, directories, relativePath).length > 0)
    return { domain, origin: "folder" };
  if (domain.matcher(relativePath)) return { domain, origin: "glob" };
  return undefined;
}

/** Among the domains that claim the file, the deepest wins; between domains of the same depth, the last declared. */
function matchingDomain(relativePath: string, domains: DomainMatcher): Claim | undefined {
  const directories = directoriesOf(relativePath);
  let best: Claim | undefined;
  for (const domain of domains) {
    const claim = claimOf(domain, relativePath, directories);
    if (claim === undefined) continue;
    if (best === undefined || claim.domain.depth >= best.domain.depth) best = claim;
  }
  return best;
}

/**
 * Decreasing precedence: the frontmatter `domain`, the folders and globs evaluated on the
 * source-relative path, then `unclassified`.
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
  if (matched !== undefined) {
    return { domain: matched.domain.path, origin: matched.origin, declared: true };
  }
  return { domain: UNCLASSIFIED_DOMAIN, origin: "unclassified", declared: true };
}
