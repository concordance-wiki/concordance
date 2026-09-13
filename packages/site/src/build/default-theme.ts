import type { ThemeConfig } from "../css/theme-config.js";

/** A neutral palette for a project without `theme.yaml`, the one the gallery renders with too. */
export function defaultThemeConfig(name: string): ThemeConfig {
  return {
    name,
    radius: 8,
    light: {
      bg: "#F6F5F2",
      surface: "#FFFFFF",
      border: "#E4E1DA",
      ink: "#16181B",
      muted: "#4E5259",
      accent: "#B84820",
    },
    dark: {
      bg: "#0E0F11",
      surface: "#16181B",
      border: "#26292E",
      ink: "#E8E6E1",
      muted: "#8B9199",
      accent: "#E8703A",
    },
  };
}
