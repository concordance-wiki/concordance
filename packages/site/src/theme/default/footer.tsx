import type { JSX } from "preact";

import type { FooterLabels, FooterProps } from "../../slots.js";

/** Where the credit of the footer points when the theme asks for one. */
export const REPOSITORY_URL = "https://github.com/concordance-wiki/concordance";
/** The name of the tool, written only when the theme credits it. */
export const TOOL_NAME = "Concordance";

/** The English strings of the footer, kept out of `labels.ts` so that the island bundles, which take that module whole, do not carry them. */
const english = {
  thisSite: "This site",
  publishedOn: "Published on {date}.",
  publishedFrom: "Published on {date}, from",
  sources: "See the sources and their versions",
  builtWith: "Built with",
  generator: "a static site generator",
  licence: "under the GNU GPL v3 or later licence.",
  content: "The content belongs to its organisation.",
  declared: "Declared by the organisation",
  publication: "publication",
  profile: "profile {profile}",
  pages: "{count} pages",
} as const;

/** The labels of the default theme for every label the footer does not receive, the build instant and the counts set in from the props. */
export function defaultFooterLabels({
  generatedAt,
  repositories,
  profile,
  pages,
}: FooterProps): FooterLabels {
  return {
    thisSite: english.thisSite,
    published: (repositories === undefined ? english.publishedOn : english.publishedFrom).replace(
      "{date}",
      generatedAt,
    ),
    sources: english.sources,
    builtWith: english.builtWith,
    generator: english.generator,
    licence: english.licence,
    content: english.content,
    declared: english.declared,
    publication: english.publication,
    buildAt: generatedAt,
    profile: english.profile.replace("{profile}", profile ?? ""),
    pages: english.pages.replace("{count}", String(pages ?? 0)),
  };
}

/**
 * The sentence naming the generator: the tool named and linked to its repository when the
 * theme credits it, an unnamed static site generator otherwise, then its licence and to whom
 * the content belongs.
 */
function Generator({ credit, text }: { credit: boolean; text: FooterLabels }): JSX.Element {
  return (
    <p class="site-footer-licence">
      {text.builtWith}{" "}
      {credit && (
        <>
          <a class="site-footer-credit" href={REPOSITORY_URL}>
            {TOOL_NAME}
          </a>
          {", "}
        </>
      )}
      {text.generator} {text.licence} {text.content}
    </p>
  );
}

/**
 * The footer of every page: what the tool knows, the build instant and where the content comes
 * from, then what the organisation declared, a column shown only when something was; under
 * them the build line in the monospace family, the to-do page with its count at its end.
 */
export function Footer(props: FooterProps): JSX.Element {
  const {
    generatedAt,
    repositories,
    aboutHref,
    profile,
    pages,
    text: declared,
    links,
    todo,
    credit,
  } = props;
  const text: FooterLabels = { ...defaultFooterLabels(props), ...props.labels };
  const declaredAny = declared !== undefined || links.length > 0;
  return (
    <footer class="site-footer">
      <div class="site-footer-card">
        <div class="site-footer-columns">
          <div class="site-footer-site">
            <h2 class="site-footer-heading">{text.thisSite}</h2>
            <p class="site-footer-published">
              {text.published}
              {repositories !== undefined && (
                <>
                  {" "}
                  <a href={repositories.href}>{repositories.label}</a>.
                </>
              )}
              {aboutHref !== undefined && (
                <>
                  {" "}
                  <a href={aboutHref}>{text.sources}</a>.
                </>
              )}
            </p>
            <Generator credit={credit} text={text} />
          </div>
          {declaredAny && (
            <div class="site-footer-declared">
              <h2 class="site-footer-heading">{text.declared}</h2>
              {declared !== undefined && <p class="site-footer-text">{declared}</p>}
              {links.length > 0 && (
                <ul class="site-footer-links">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <p class="site-footer-build">
          {text.publication} <time dateTime={generatedAt}>{text.buildAt}</time>
          {profile !== undefined && ` · ${text.profile}`}
          {pages !== undefined && ` · ${text.pages}`}
          {todo !== undefined && (
            <>
              {" · "}
              <a class="site-footer-todo" href={todo.href}>
                {todo.label}
                {todo.count !== undefined && <span class="count">{todo.count}</span>}
              </a>
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
