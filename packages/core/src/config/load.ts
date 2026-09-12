import { parse, type YAMLParseError } from "yaml";

import type { ConfigValidation } from "./types.js";
import { validateConfig } from "./validate.js";

export function parseConfig(text: string): ConfigValidation {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    const detail = (error as YAMLParseError).message.split("\n", 1).join("");
    return {
      ok: false,
      issues: [{ severity: "error", path: "", message: `not valid YAML: ${detail}` }],
    };
  }
  return validateConfig(document);
}
