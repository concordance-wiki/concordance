import type { JSX } from "preact";

import type { IndexProps } from "../../slots.js";
import { labels } from "./labels.js";

export function Index({ letters, current, entries }: IndexProps): JSX.Element {
  return (
    <div class="index">
      <h1>{labels.index}</h1>
      <nav class="letters" aria-label={labels.letters}>
        <ul>
          {letters.map((letter) => (
            <li key={letter.letter}>
              {letter.href === undefined ? (
                <span class="letter inactive" aria-disabled="true">
                  {letter.letter}
                </span>
              ) : (
                <a
                  class="letter"
                  href={letter.href}
                  aria-current={letter.letter === current ? "page" : undefined}
                >
                  {letter.letter}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <ul class="index-entries">
        {entries.map((entry) => (
          <li key={entry.href} class="index-entry" id={entry.anchor}>
            {entry.glyph === undefined ? (
              <span class="noteless">{labels.noteless}</span>
            ) : (
              <span class="glyph" aria-hidden="true">
                {entry.glyph}
              </span>
            )}
            <a href={entry.href}>{entry.label}</a>
            <span class="count">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
