import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/i18n", () => {
  it("exposes the catalogue loader, the message formatter, the platform formatters and the label validator", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CatalogueError",
      "SOURCE_LANGUAGE",
      "argumentNames",
      "argumentsOf",
      "formatDate",
      "formatMessage",
      "formatMonth",
      "formatMonthName",
      "formatNumber",
      "formatRelative",
      "loadCatalogue",
      "messageArguments",
      "messageIds",
      "parseMessage",
      "resolveLanguage",
      "shippedLanguages",
      "textDirection",
      "validateLabels",
      "validateOverride",
      "validateOverrides",
    ]);
  });
});
