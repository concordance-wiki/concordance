import type { ThemeConfig } from "../css/theme-config.js";

/**
 * The palettes of the default theme, for a project without `theme.yaml` and for the gallery: a
 * warm light one, and a dark one measured on its own rather than inverted from the first: the
 * ground goes under the surface, as in the light scheme but the other way round, and the accent
 * rises in lightness to hold 4.5:1 over the dark grounds. The accent marks links and the current
 * position only.
 */
export function defaultThemeConfig(name: string): ThemeConfig {
  return {
    name,
    radius: 8,
    light: {
      bg: "#EFEDE9",
      surface: "#FFFFFF",
      border: "#E3E0DA",
      ink: "#1F2124",
      muted: "#3A3E44",
      accent: "#A8431C",
      label: "#676C74",
      soft: "#F7F6F3",
      highlight: "#FBE3D4",
    },
    dark: {
      bg: "#0F1113",
      surface: "#181B1E",
      border: "#282C31",
      ink: "#ECEAE6",
      muted: "#A8AEB6",
      accent: "#E8703A",
      label: "#8D939B",
      soft: "#22262A",
      highlight: "#4A2A1B",
    },
  };
}
