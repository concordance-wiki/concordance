import type { JSX } from "preact";

import type { FooterProps } from "../../slots.js";
import { labels } from "./labels.js";

export function Footer({
  version,
  generatedAt,
  text,
  links,
  mentionTool,
}: FooterProps): JSX.Element {
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
      {mentionTool && <p class="site-footer-mention">{labels.mentionTool}</p>}
    </footer>
  );
}
