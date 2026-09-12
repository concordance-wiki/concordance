import type { JSX } from "preact";

import type { ShellProps } from "../../slots.js";
import { labels } from "./labels.js";

export function Shell({ locale, direction, title, head, children }: ShellProps): JSX.Element {
  return (
    <html lang={locale} dir={direction}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {head.stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {head.modulePreloads.map((href) => (
          <link key={href} rel="modulepreload" href={href} />
        ))}
        {head.scripts.map((src) => (
          <script key={src} type="module" defer src={src} />
        ))}
      </head>
      <body>
        <a class="skip-link" href="#main">
          {labels.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
