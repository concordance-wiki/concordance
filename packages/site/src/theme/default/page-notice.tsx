import type { JSX } from "preact";

import type { PageNotice as PageNoticeProps } from "../../slots.js";

/**
 * The notice of a page whose datum is missing, the only banner the site allows, ruled in the
 * accent: the fact in plain words, what remains, the exits, the first filled and the others
 * bordered, and the finding the build recorded behind a disclosure drawn as a button, the
 * cause first and the check identifier after it. Everything stands without JavaScript.
 */
export function PageNotice({ lead, detail, exits, finding }: PageNoticeProps): JSX.Element {
  return (
    <aside class="page-notice" role="note">
      <p class="page-notice-lead">{lead}</p>
      <p class="page-notice-detail">{detail}</p>
      <div class="page-notice-exits">
        {exits.map((exit, index) => (
          <a
            key={exit.href}
            class={index === 0 ? "button-primary" : "button-secondary"}
            href={exit.href}
            {...(exit.download === undefined ? {} : { download: exit.download })}
          >
            {exit.label}
          </a>
        ))}
        {finding !== undefined && (
          <details class="page-notice-why">
            <summary class="button-secondary">{finding.label}</summary>
            <p>
              {finding.cause} <code>{finding.check}</code>
            </p>
          </details>
        )}
      </div>
    </aside>
  );
}
