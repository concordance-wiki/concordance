import type { JSX } from "preact";

import { SLOT_NAMES, type SlotName } from "../slots.js";
import type { ThemeOverride } from "../theme/types.js";
import { GALLERY_BOARDS, screenNoteHref, type GalleryBoard } from "./boards.js";
import { DEFAULT_GALLERY_WIDTH, type GalleryWidth } from "./page.js";
import type { GalleryPage } from "./pages.js";
import type { TypePage } from "./types.js";
import { WidthSwitch } from "./width-switch.js";

export interface GalleryIndexProps {
  pages: readonly GalleryPage[];
  /** The registered types, one page each; none when the gallery was built without types. */
  types?: readonly TypePage[];
  overrides: readonly ThemeOverride[];
}

const CHROME_SLOTS: ReadonlySet<SlotName> = new Set(["Shell", "Header", "Footer"]);

/** The height of a frame at each width: the boards' phone and tablet, a desktop tall enough for a page. */
const FRAME_HEIGHTS: Record<GalleryWidth, number> = { 390: 844, 834: 1194, 1440: 900 };

function Provenance({ override }: { override: ThemeOverride | undefined }): JSX.Element {
  return override === undefined ? (
    <span class="gallery-provenance">Rendered by the default theme.</span>
  ) : (
    <span class="gallery-provenance">
      Overridden by plugin <code>{override.plugin}</code>, theme <code>{override.theme}</code>.
    </span>
  );
}

/** One state: its heading leading to the page alone, its caption, its width and who renders it, then the page framed at that width. */
function State({
  page,
  override,
}: {
  page: GalleryPage;
  override: ThemeOverride | undefined;
}): JSX.Element {
  const width = page.width ?? DEFAULT_GALLERY_WIDTH;
  const id = `state-${page.file.replace(/\.html$/, "")}`;
  const title = `${page.slot}, ${page.state}`;
  return (
    <article class="gallery-state" aria-labelledby={id}>
      <h3 id={id}>
        <a href={page.file}>{title}</a>
      </h3>
      <p class="gallery-caption">{page.description}</p>
      <p class="gallery-meta">
        <span class="gallery-width-value">{width} px</span> · <Provenance override={override} />
      </p>
      <div class="gallery-stage">
        <iframe
          class="gallery-frame"
          src={page.file}
          width={width}
          height={FRAME_HEIGHTS[width]}
          loading="lazy"
          title={title}
        />
      </div>
    </article>
  );
}

/** One board: its title, its caption with the screen note of the demonstration, then its states in page order. */
function Board({
  board,
  pages,
  overrides,
}: {
  board: GalleryBoard;
  pages: readonly GalleryPage[];
  overrides: readonly ThemeOverride[];
}): JSX.Element {
  const id = `board-${board.id.toLowerCase()}`;
  const screen = screenNoteHref(board);
  return (
    <section class="gallery-board" aria-labelledby={id}>
      <h2 id={id}>{board.id.startsWith("B") ? `${board.id} · ${board.title}` : board.title}</h2>
      <p class="gallery-board-caption">
        {board.caption}
        {screen !== undefined && (
          <>
            {" "}
            <a href={screen}>Screen note</a>
          </>
        )}
      </p>
      {pages.map((page) => (
        <State
          key={page.file}
          page={page}
          override={overrides.find((override) => override.slot === page.slot)}
        />
      ))}
    </section>
  );
}

/** Every slot in order and who renders it; the chrome slots are seen on every page. */
function Slots({ overrides }: { overrides: readonly ThemeOverride[] }): JSX.Element {
  return (
    <section class="gallery-slots" aria-labelledby="gallery-slots">
      <h2 id="gallery-slots">Slots</h2>
      <ul>
        {SLOT_NAMES.map((name) => (
          <li key={name} id={`slot-${name.toLowerCase()}`}>
            {name}: <Provenance override={overrides.find((override) => override.slot === name)} />
            {CHROME_SLOTS.has(name) && " Seen on every page of the gallery."}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The registered types, each with the component that renders its page. */
function Types({ types }: { types: readonly TypePage[] }): JSX.Element {
  return (
    <section class="gallery-slot" aria-labelledby="gallery-types">
      <h2 id="gallery-types">Types</h2>
      <p class="gallery-provenance">
        Every registered type, its note template rendered as a note of that type: through the
        generic entity page, or through the component a theme or the type module provides for it.
      </p>
      <ul>
        {types.map((page) => (
          <li key={page.file}>
            <a href={page.file}>{page.type}</a>: {page.label},{" "}
            {page.override === undefined ? (
              "generic entity page"
            ) : (
              <>
                <code>{page.override.slot}</code> of <code>{page.override.plugin}</code>,{" "}
                <code>{page.override.theme}</code>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The entry page of the gallery: the states grouped by board of the reference design in the
 * order of the boards, each framed at the width of its board with its caption and the screen
 * note of the demonstration, then every slot with who renders it, and the registered types.
 */
export function GalleryIndex({ pages, types = [], overrides }: GalleryIndexProps): JSX.Element {
  return (
    <div class="gallery">
      <h1>Component gallery</h1>
      <p>
        Every slot of the site rendered through the current theme with fixture view models, one
        state per board of the reference design and the degraded cases beside them. The links inside
        the pages lead nowhere: the data is invented. The labels are those of the default theme.
      </p>
      <p>
        Each state is framed at the width of its board, 390 px for a phone, 834 px for a tablet,
        1440 px for a desktop, and opens alone through its heading. The buttons set every frame to
        one width once the script runs; without it each frame keeps its own.
      </p>
      <p>
        Dark scheme: the stylesheet follows the system preference, and the switch in the header
        forces a scheme and remembers it; without JavaScript, set <code>data-mode="dark"</code> on
        the root element of a page to preview the dark palette.
      </p>
      <WidthSwitch />
      {GALLERY_BOARDS.map((board) => (
        <Board
          key={board.id}
          board={board}
          pages={pages.filter((page) => page.board === board.id)}
          overrides={overrides}
        />
      ))}
      <Slots overrides={overrides} />
      {types.length > 0 && <Types types={types} />}
    </div>
  );
}
