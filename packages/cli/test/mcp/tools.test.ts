import { describe, expect, it } from "vitest";

import { argvOf, TOOLS } from "../../src/mcp/tools.js";

const model = ["--model", "dist/model.json"];

describe("the tools of the façade stand for the arguments of query", () => {
  it("names one tool per family, each with a schema that refuses unknown arguments", () => {
    expect(TOOLS.map((tool) => tool.name)).toEqual([
      "lookup",
      "search",
      "relations",
      "list",
      "corpus",
      "passages",
    ]);
    for (const tool of TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
      expect(tool.inputSchema).toHaveProperty(["properties", "format"]);
      expect(tool.inputSchema).toHaveProperty(["properties", "limit"]);
    }
  });

  it("maps every argument of lookup, and leaves out what is not given or not of the right type", () => {
    expect(argvOf("lookup", { expression: "keyword page" }, model)).toEqual([
      "keyword page",
      "--model",
      "dist/model.json",
      "--no-age",
    ]);
    expect(
      argvOf(
        "lookup",
        {
          expression: "x",
          sections: ["links", 3, "related"],
          direction: "in",
          relation: "affects",
          context: 2,
          limit: 4,
          format: "json",
        },
        [],
      ),
    ).toEqual([
      "x",
      "--links",
      "--related",
      "--direction",
      "in",
      "--relation",
      "affects",
      "--context",
      "2",
      "--format",
      "json",
      "--limit",
      "4",
      "--no-age",
    ]);
    expect(argvOf("lookup", { expression: 7, limit: 1.5, format: "" }, [])).toEqual([
      "",
      "--no-age",
    ]);
  });

  it("maps search, relations, list, corpus and passages", () => {
    expect(
      argvOf("search", { words: "threshold", type: "rule", source: "specs", keywords: "only" }, []),
    ).toEqual([
      "--search",
      "threshold",
      "--type",
      "rule",
      "--source",
      "specs",
      "--keywords-only",
      "--no-age",
    ]);
    expect(argvOf("search", { words: "threshold", keywords: "exclude" }, [])).toEqual([
      "--search",
      "threshold",
      "--no-keywords",
      "--no-age",
    ]);
    expect(argvOf("relations", { expression: "a", mode: "near", radius: 2 }, [])).toEqual([
      "a",
      "--near",
      "--radius",
      "2",
      "--no-age",
    ]);
    expect(
      argvOf("relations", { expression: "a", mode: "explain", target: "b", context: 1 }, []),
    ).toEqual(["a", "--explain", "b", "--context", "1", "--no-age"]);
    expect(
      argvOf("relations", { expression: "a", mode: "path", target: "b", max_depth: 3 }, []),
    ).toEqual(["a", "--path", "b", "--max-depth", "3", "--no-age"]);
    expect(
      argvOf("list", { domain: "quality", application: "cli", status: "valid", all: true }, []),
    ).toEqual([
      "--list",
      "--domain",
      "quality",
      "--application",
      "cli",
      "--status",
      "valid",
      "--all",
      "--no-age",
    ]);
    expect(argvOf("corpus", { question: "changed_with", expression: "a" }, [])).toEqual([
      "a",
      "--changed-with",
      "--no-age",
    ]);
    expect(
      argvOf(
        "corpus",
        { question: "recent", since: "2026-03-01", source: "notes", min_files: 2, check: "W-X" },
        [],
      ),
    ).toEqual([
      "--recent",
      "--min-files",
      "2",
      "--since",
      "2026-03-01",
      "--source",
      "notes",
      "--check",
      "W-X",
      "--no-age",
    ]);
    expect(argvOf("corpus", {}, [])).toEqual(["--stats", "--no-age"]);
    expect(argvOf("passages", { phrase: "one page", source: "briefs" }, [])).toEqual([
      "--text",
      "one page",
      "--source",
      "briefs",
      "--no-age",
    ]);
    expect(argvOf("search", { keywords: "any" }, [])).toEqual(["--search", "", "--no-age"]);
    expect(argvOf("relations", { mode: "near" }, [])).toEqual(["", "--near", "--no-age"]);
    expect(argvOf("list", { all: false }, [])).toEqual(["--list", "--no-age"]);
    expect(argvOf("passages", {}, [])).toEqual(["--text", "", "--no-age"]);
    expect(argvOf("nothing", {}, [])).toBeUndefined();
  });
});
