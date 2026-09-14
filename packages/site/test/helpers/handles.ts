/** The handle of the tree of the space, as every page with a tree serves it: hidden, named, unfolded. */
export const TREE_HANDLE =
  '<div class="panel-handle-track"><button type="button" class="panel-handle" data-panel="tree" aria-expanded="true" title="Fold or unfold" hidden><span class="visually-hidden">Tree of the space</span></button></div>';

/** The handle of the right panel, as every page with a panel serves it. */
export const PANEL_HANDLE =
  '<div class="panel-handle-track"><button type="button" class="panel-handle" data-panel="panel" aria-expanded="true" title="Fold or unfold" hidden><span class="visually-hidden">Right panel</span></button></div>';

/** The button pinning the page, as every entity page serves it after its title: hidden, unpressed. */
export const PIN_BUTTON =
  '<button type="button" class="pin-button" aria-pressed="false" hidden><span class="pin-button-glyph"><svg class="pin-glyph" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" focusable="false"><path d="M12 17v5M7 4h10l-1.5 7 3 3H5.5l3-3z"></path></svg></span><span class="pin-button-label">Pin</span></button>';

/** The page without the hidden controls its scripts reveal, the handles of its panels and its pin button, for the assertions about the other controls it serves. */
export function withoutHiddenControls(html: string): string {
  return html.replaceAll(TREE_HANDLE, "").replaceAll(PANEL_HANDLE, "").replaceAll(PIN_BUTTON, "");
}
