/** The handle of the tree of the space, as every page with a tree serves it: hidden, named, unfolded. */
export const TREE_HANDLE =
  '<div class="panel-handle-track"><button type="button" class="panel-handle" data-panel="tree" aria-expanded="true" title="Fold or unfold" hidden><span class="visually-hidden">Tree of the space</span></button></div>';

/** The handle of the right panel, as every page with a panel serves it. */
export const PANEL_HANDLE =
  '<div class="panel-handle-track"><button type="button" class="panel-handle" data-panel="panel" aria-expanded="true" title="Fold or unfold" hidden><span class="visually-hidden">Right panel</span></button></div>';

/** The page without the handles of its panels, for the assertions about the other controls it serves. */
export function withoutHandles(html: string): string {
  return html.replaceAll(TREE_HANDLE, "").replaceAll(PANEL_HANDLE, "");
}
