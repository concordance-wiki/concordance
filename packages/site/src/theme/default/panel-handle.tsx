import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { FoldablePanel, PanelsLabels, PanelsProps } from "../../slots.js";
import { labels } from "./labels.js";

export const PANELS_ISLAND = "panels";

/** The labels of the default theme, used when the header receives none. */
export const defaultPanelsLabels: PanelsLabels = {
  fold: labels.foldPanel,
  tree: labels.spaceTree,
  panel: labels.rightPanel,
};

/** The island is served empty: it carries the labels its script writes on the handles of the page. */
function PanelsRegion(): null {
  return null;
}

const PanelsIsland = island<PanelsProps>(PANELS_ISLAND, PanelsRegion);

export function Panels({ panels }: { panels?: PanelsProps }): JSX.Element {
  return <PanelsIsland {...(panels ?? { labels: defaultPanelsLabels })} />;
}

/**
 * The handle on the edge of a side panel: a tab of paper half slid behind the panel, without
 * any label, which folds the panel and unfolds it. Its track sticks to the middle of the
 * viewport along the panel, so that it always stands at the same place. It is served hidden
 * with the English name of its panel and does nothing until the panels island wires it: without
 * JavaScript every panel stands open and no dead control is shown. Served folded, for a preview
 * of the page as a reader who folded the panel sees it, the handle is drawn alone, a decoration
 * rather than a control nothing would wire.
 */
export function PanelHandle({
  panel,
  name,
  folded = false,
}: {
  panel: FoldablePanel;
  /** The accessible name of the handle: the name of its panel, its state announced after it. */
  name: string;
  folded?: boolean;
}): JSX.Element {
  return (
    <div class="panel-handle-track">
      {folded ? (
        <span class="panel-handle panel-handle-folded" data-panel={panel} aria-hidden="true" />
      ) : (
        <button
          type="button"
          class="panel-handle"
          data-panel={panel}
          aria-expanded="true"
          title={labels.foldPanel}
          hidden
        >
          <span class="visually-hidden">{name}</span>
        </button>
      )}
    </div>
  );
}

/** The right panel of a page: the handle on its edge, then its blocks. */
export function SidePanel({
  folded = false,
  children,
}: {
  folded?: boolean;
  children: JSX.Element | (JSX.Element | false)[];
}): JSX.Element {
  return (
    <div class="entity-side">
      <PanelHandle panel="panel" name={labels.rightPanel} folded={folded} />
      {children}
    </div>
  );
}
