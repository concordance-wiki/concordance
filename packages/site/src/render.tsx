import { textDirection } from "@concordance-wiki/i18n";
import { h, type JSX } from "preact";
import { renderToString } from "preact-render-to-string";

import type { ColourScheme } from "./css/tokens.js";
import type { IslandBundle } from "./islands/bundle.js";
import { islandsUsed } from "./islands/island.js";
import { MODE_SCRIPT } from "./mode.js";
import { PANELS_SCRIPT } from "./panels.js";
import type { HeadAssets, SlotName, SlotProps } from "./slots.js";
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
  /** Href the page forwards to at once; the head carries it as a refresh. */
  redirect?: string;
  /** A scheme forced on the root, to preview a palette: the page then carries no script applying a remembered choice. */
  scheme?: ColourScheme;
  /** The address of the page itself, for a page the host serves at other addresses than its own; the head carries it as a base. */
  base?: string;
  /** What stands between the header and the main landmark on every page: the notice on the age of the site, when the site counts its days. */
  notice?: JSX.Element;
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

/**
 * Where the shell writes its children: a text no shell writes on its own, replaced by the body
 * rendered once. The body is rendered before the shell, so that the islands it uses are known
 * when the head is written, and the shell alone is rendered around it: a page costs one render
 * of its content, not two.
 */
const BODY_MARK = "\u0000concordance:body\u0000";

/** The header, the notice, the main landmark holding the body and the footer, rendered once. */
function content(body: JSX.Element, options: RenderOptions): string {
  const { Header, Footer } = options.theme.components;
  return renderToString(
    <ThemeContext.Provider value={options.theme}>
      <Header {...options.header} />
      {options.notice}
      <main id="main">{body}</main>
      <Footer {...options.footer} />
    </ThemeContext.Provider>,
  );
}

/** The shell around the mark, split where the content goes. */
function frame(options: RenderOptions, head: HeadAssets): [string, string] {
  const { Shell } = options.theme.components;
  const shell = renderToString(
    <ThemeContext.Provider value={options.theme}>
      <Shell
        locale={options.locale}
        direction={textDirection(options.locale)}
        title={options.title}
        head={head}
        {...(options.scheme === undefined ? {} : { scheme: options.scheme })}
      >
        {BODY_MARK}
      </Shell>
    </ThemeContext.Provider>,
  );
  const [before, after, ...rest] = shell.split(BODY_MARK);
  if (before === undefined || after === undefined || rest.length > 0) {
    throw new Error("renderDocument: the shell must write its children exactly once");
  }
  return [before, after];
}

function bundlesFor(names: string[], options: RenderOptions): IslandBundle[] {
  return names.map((name) => {
    const bundle = options.islands.find((candidate) => candidate.name === name);
    if (bundle === undefined) {
      throw new Error(`renderPage: island ${name} has no bundle`);
    }
    return bundle;
  });
}

function hrefsOf(bundles: IslandBundle[], options: RenderOptions): string[] {
  const base = options.assetsBase ?? "";
  return bundles.map((bundle) => `${base}${bundle.file}`);
}

/** A complete HTML document around any body: the shell, the header, the main landmark holding the body, the footer. */
export function renderDocument(body: JSX.Element, options: RenderOptions): string {
  const inner = content(body, options);
  const bundles = bundlesFor(islandsUsed(inner), options);
  const modules = hrefsOf(
    bundles.filter((bundle) => bundle.module === true),
    options,
  );
  const head: HeadAssets = {
    inlineScripts: [...(options.scheme === undefined ? [MODE_SCRIPT] : []), PANELS_SCRIPT],
    stylesheets: options.stylesheets,
    modulePreloads: modules,
    scripts: modules,
    ...(bundles.length === 0
      ? {}
      : {
          classicScripts: hrefsOf(
            bundles.filter((bundle) => bundle.module !== true),
            options,
          ),
        }),
    ...(options.favicon === undefined ? {} : { favicon: options.favicon }),
    ...(options.redirect === undefined ? {} : { redirect: options.redirect }),
    ...(options.base === undefined ? {} : { base: options.base }),
  };
  const [before, after] = frame(options, head);
  return `<!doctype html>\n${before}${inner}${after}\n`;
}

/** The complete HTML document of a page; a page without an island carries no script. */
export function renderPage<S extends PageSlot>(
  slot: S,
  props: SlotProps[S],
  options: RenderOptions,
): string {
  return renderDocument(h(options.theme.components[slot], props), options);
}
