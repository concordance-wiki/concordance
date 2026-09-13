import { h, type JSX } from "preact";
import { renderToString } from "preact-render-to-string";

import type { IslandBundle } from "./islands/bundle.js";
import { islandsUsed } from "./islands/island.js";
import { MODE_SCRIPT } from "./mode.js";
import type { HeadAssets, SlotName, SlotProps, TextDirection } from "./slots.js";
import { ThemeContext } from "./theme/context.js";
import type { ResolvedTheme } from "./theme/types.js";

export type PageSlot = Exclude<SlotName, "Shell">;

export interface RenderOptions {
  theme: ResolvedTheme;
  /** BCP 47 tag of the page. */
  locale: string;
  title: string;
  /** Stylesheet hrefs relative to the page, in loading order. */
  stylesheets: string[];
  /** Href of the favicon relative to the page. */
  favicon?: string;
  /** Every bundle the build produced; only those the page uses are loaded. */
  islands: IslandBundle[];
  /** Prefix of the bundle hrefs relative to the page, `../assets/` for instance. */
  assetsBase?: string;
  header: SlotProps["Header"];
  footer: SlotProps["Footer"];
}

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

export function directionOf(locale: string): TextDirection {
  return RTL_LANGUAGES.has(locale.toLowerCase().replace(/-.*$/, "")) ? "rtl" : "ltr";
}

/** A slot alone, inside the theme, for tests and galleries. */
export function renderSlot<S extends SlotName>(
  slot: S,
  props: SlotProps[S],
  theme: ResolvedTheme,
): string {
  return renderToString(
    <ThemeContext.Provider value={theme}>{h(theme.components[slot], props)}</ThemeContext.Provider>,
  );
}

function document(body: JSX.Element, options: RenderOptions, head: HeadAssets): string {
  const { Shell, Header, Footer } = options.theme.components;
  const page: JSX.Element = (
    <Shell
      locale={options.locale}
      direction={directionOf(options.locale)}
      title={options.title}
      head={head}
    >
      <Header {...options.header} />
      <main id="main">{body}</main>
      <Footer {...options.footer} />
    </Shell>
  );
  return renderToString(
    <ThemeContext.Provider value={options.theme}>{page}</ThemeContext.Provider>,
  );
}

function scriptsFor(names: string[], options: RenderOptions): string[] {
  const base = options.assetsBase ?? "";
  return names.map((name) => {
    const bundle = options.islands.find((candidate) => candidate.name === name);
    if (bundle === undefined) {
      throw new Error(`renderPage: island ${name} has no bundle`);
    }
    return `${base}${bundle.file}`;
  });
}

/** A complete HTML document around any body: the shell, the header, the main landmark holding the body, the footer. */
export function renderDocument(body: JSX.Element, options: RenderOptions): string {
  const head: HeadAssets = {
    inlineScripts: [MODE_SCRIPT],
    stylesheets: options.stylesheets,
    modulePreloads: [],
    scripts: [],
    ...(options.favicon === undefined ? {} : { favicon: options.favicon }),
  };
  const first = document(body, options, head);
  const islands = islandsUsed(first);
  // Components are pure: rendering again with the scripts known gives the same body.
  const html =
    islands.length === 0
      ? first
      : document(body, options, {
          ...head,
          modulePreloads: scriptsFor(islands, options),
          scripts: scriptsFor(islands, options),
        });
  return `<!doctype html>\n${html}\n`;
}

/** The complete HTML document of a page; a page without an island carries no script. */
export function renderPage<S extends PageSlot>(
  slot: S,
  props: SlotProps[S],
  options: RenderOptions,
): string {
  return renderDocument(h(options.theme.components[slot], props), options);
}
