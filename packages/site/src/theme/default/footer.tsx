import type { JSX } from "preact";

import type { FooterProps } from "../../slots.js";
import { labels } from "./labels.js";

/** Where the optional credit of the footer points. */
export const REPOSITORY_URL = "https://github.com/concordance-wiki/concordance";

export function Footer({ version, generatedAt, text, links, credit }: FooterProps): JSX.Element {
  return (
    <footer class="site-footer">
      {text !== undefined && <p class="site-footer-text">{text}</p>}
      {links.length > 0 && (
        <ul class="site-footer-links">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
      )}
      <p class="site-footer-build">
        {labels.version} {version}, {labels.builtOn}{" "}
        <time dateTime={generatedAt}>{generatedAt}</time>
      </p>
      {credit && (
        <p class="site-footer-credit">
          <a href={REPOSITORY_URL}>{labels.credit}</a>
        </p>
      )}
    </footer>
  );
}
