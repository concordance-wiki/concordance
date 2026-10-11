/**
 * An `href` attribute when there is an address, none otherwise. Preact 10 rendered
 * `href={undefined}` as no attribute at all; preact 11 types an optional attribute strictly, so the
 * absence is spelled out here, once, with the same output.
 */
export function optionalHref(href: string | undefined): { href?: string } {
  return href === undefined ? {} : { href };
}
