import { createContext, type ComponentType } from "preact";
import { useContext } from "preact/hooks";

import type {
  AttributeProps,
  EntityPageProps,
  SectionProps,
  SlotName,
  SlotProps,
} from "../slots.js";
import type { ResolvedTheme } from "./types.js";

/** The theme of the page being rendered; `renderPage` and `renderSlot` provide it. */
export const ThemeContext = createContext<ResolvedTheme | null>(null);

function themeOf(caller: string): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(`${caller}: no theme in context; render through renderPage or renderSlot`);
  }
  return theme;
}

/** The component of a slot in the current theme, so that a page composes the panels a plugin may override. */
export function useSlot<S extends SlotName>(slot: S): ComponentType<SlotProps[S]> {
  return themeOf(`useSlot(${slot})`).components[slot];
}

/** The page component of a type: `EntityPage@<type>` when a theme or the type module provides it, else `EntityPage`. */
export function pageComponentFor(
  theme: ResolvedTheme,
  type: string,
): ComponentType<EntityPageProps> {
  return theme.typed?.pages[type] ?? theme.components.EntityPage;
}

/** The component of an attribute value on a page of `type`: the theme's `Attribute@<name>`, else the type module's, else none. */
export function attributeComponentFor(
  theme: ResolvedTheme,
  type: string,
  name: string,
): ComponentType<AttributeProps> | undefined {
  const { typed } = theme;
  return typed?.parts.attributes[name] ?? typed?.typeParts[type]?.attributes[name];
}

/** The component of a mapped section on a page of `type`: the theme's `Section@<key>`, else the type module's, else none. */
export function sectionComponentFor(
  theme: ResolvedTheme,
  type: string,
  key: string,
): ComponentType<SectionProps> | undefined {
  const { typed } = theme;
  return typed?.parts.sections[key] ?? typed?.typeParts[type]?.sections[key];
}

/** `attributeComponentFor` on the theme in context, for the components of the default theme. */
export function useAttributePart(
  type: string,
  name: string,
): ComponentType<AttributeProps> | undefined {
  return attributeComponentFor(themeOf(`useAttributePart(${name})`), type, name);
}

/** `sectionComponentFor` on the theme in context, for the components of the default theme. */
export function useSectionPart(type: string, key: string): ComponentType<SectionProps> | undefined {
  return sectionComponentFor(themeOf(`useSectionPart(${key})`), type, key);
}
