import { memoryFileSystem, RESERVED_SOURCE_NAMES } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { assemblePages } from "../../src/build/assemble.js";
import { defaultThemeConfig } from "../../src/build/default-theme.js";
import {
  ABOUT_PAGE,
  ASSETS_DIRECTORY,
  FRAGMENTS_DIRECTORY,
  INDEX_PAGE,
  SEARCH_PAGE,
  SPACES_PAGE,
  TODO_PAGE,
} from "../../src/build/paths.js";
import { defaultTheme } from "../../src/theme/resolve.js";

describe("assemblePages", () => {
  it("fails on two documents at one path instead of writing one over the other", async () => {
    const fileSystem = memoryFileSystem();
    const page =
      '<!doctype html>\n<html lang="en"><head><title>x</title></head><body></body></html>\n';
    await expect(
      assemblePages({
        output: "/out",
        theme: defaultTheme,
        fileSystem,
        fallback: defaultThemeConfig("Test"),
        maxPageBytes: 150_000,
        islands: [],
        documents: () => [
          { path: "notes/index.html", content: page },
          { path: "notes/index.html", content: page },
        ],
      }),
    ).rejects.toThrow("assemblePages: two documents share the path notes/index.html");
  });
});

describe("the folders the site reserves", () => {
  it("are the ones the configuration refuses as source names, keyword pages included", () => {
    const folders = [ABOUT_PAGE, INDEX_PAGE, SEARCH_PAGE, SPACES_PAGE, TODO_PAGE]
      .map((page) => page.slice(0, page.indexOf("/")))
      .concat([ASSETS_DIRECTORY, FRAGMENTS_DIRECTORY, "keywords"])
      .sort();
    expect(folders).toEqual([...RESERVED_SOURCE_NAMES]);
  });
});
