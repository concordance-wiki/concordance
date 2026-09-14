/**
 * The scripts the island bundles are loaded with, as `renderDocument` writes them: a deferred
 * classic script per island the page uses, a module script and its preload for a bundle built
 * as a module. The inline boot script of the colour scheme is not one of them.
 */
const ISLAND_SCRIPTS =
  /<script (?:defer|type="module" defer) src="[^"]*"><\/script>|<link rel="modulepreload" href="[^"]*"\/>/g;

/** The page as a reader without JavaScript gets it: the same HTML, the scripts of its islands gone. */
export function withoutIslandScripts(html: string): string {
  return html.replace(ISLAND_SCRIPTS, "");
}
