/** The palette of one mode, six colours as `#RRGGBB`. */
export interface ThemePalette {
  bg: string;
  surface: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
}

/** A `theme.yaml` document once validated by the theme schema. */
export interface ThemeConfig {
  name: string;
  logo?: string;
  favicon?: string;
  font?: { display?: string; ui?: string; mono?: string };
  radius?: number;
  light: ThemePalette;
  dark: ThemePalette;
  default_mode?: "light" | "dark" | "system";
  footer?: { text?: string; links?: { label: string; url: string }[]; mention_tool?: boolean };
  stylesheet?: string;
  labels?: Record<string, Record<string, string>>;
}
