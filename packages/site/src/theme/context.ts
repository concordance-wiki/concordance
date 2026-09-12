import { createContext, type ComponentType } from "preact";
import { useContext } from "preact/hooks";

import type { SlotName, SlotProps } from "../slots.js";
import type { ResolvedTheme } from "./types.js";

/** The theme of the page being rendered; `renderPage` and `renderSlot` provide it. */
export const ThemeContext = createContext<ResolvedTheme | null>(null);

/** The component of a slot in the current theme, so that a page composes the panels a plugin may override. */
export function useSlot<S extends SlotName>(slot: S): ComponentType<SlotProps[S]> {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(
      `useSlot(${slot}): no theme in context; render through renderPage or renderSlot`,
    );
  }
  return theme.components[slot];
}
