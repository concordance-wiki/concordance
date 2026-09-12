import { corePack } from "./core-pack.js";
import type { LanguagePack } from "./pack.js";

// Mirrors the `type_prefixes.en` block of the default profile.
export const en: LanguagePack = corePack("en", {
  screen: ["screen", "page"],
  api: ["api", "service"],
  data_object: ["table"],
  batch: ["batch", "job"],
  rule: ["rule"],
  process: ["process"],
});
