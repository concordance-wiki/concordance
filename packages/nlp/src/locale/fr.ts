import { corePack } from "./core-pack.js";
import type { LanguagePack } from "./pack.js";

// Mirrors the `type_prefixes.fr` block of the default profile.
export const fr: LanguagePack = corePack("fr", {
  screen: ["écran", "page"],
  api: ["api", "service"],
  data_object: ["table"],
  batch: ["batch", "traitement"],
  rule: ["règle"],
  process: ["processus"],
});
