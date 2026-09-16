import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { locateModel } from "../../src/query/locate.js";
import { recordedIo, validConfig } from "../helpers.js";

async function built(config = validConfig, cwd = "/work") {
  const io = recordedIo(
    {
      [`${cwd}/concordance.yaml`]: config,
      [`${cwd}/notes/a.md`]: "---\ntype: term\n---\n# A\n",
    },
    cwd,
  );
  await buildCommand([], io);
  io.stdout.splice(0);
  io.stderr.splice(0);
  return io;
}

describe("locateModel finds the model to read, or says where it looked", () => {
  it("reads the file --model names, from anywhere, and says when it is missing or not a model", async () => {
    const io = await built();
    const named = await locateModel(io, { model: "dist/model.json" });
    expect(named).toMatchObject({
      ok: true,
      file: "dist/model.json",
      origin: "option",
      directory: "/work/dist",
    });
    expect(await locateModel(io, { model: "elsewhere.json" })).toEqual({
      ok: false,
      lines: [
        "/work/elsewhere.json: model file not found; run concordance build first or name one with --model",
      ],
    });
    io.fs.writeText("/work/bad.json", '{"version": 2}');
    const bad = await locateModel(io, { model: "bad.json" });
    expect(bad.ok).toBe(false);
    expect(bad.ok ? [] : bad.lines).not.toHaveLength(0);
    const broken = {
      ...io,
      fs: {
        ...io.fs,
        readText: () => {
          throw new Error("disk gone");
        },
      },
    };
    await expect(locateModel(broken, { model: "bad.json" })).rejects.toThrow("disk gone");
  });

  it("goes through the configuration of the working directory, or of --config, to its output directory", async () => {
    const io = await built();
    expect(await locateModel(io, {})).toMatchObject({
      ok: true,
      file: "/work/dist/model.json",
      origin: "configuration",
      directory: "/work/dist",
    });
    const elsewhere = await built(
      validConfig.replace("sources:", "build: { output: ./out }\nsources:"),
      "/other",
    );
    expect(await locateModel(elsewhere, { config: "/other/concordance.yaml" })).toMatchObject({
      ok: true,
      file: "/other/out/model.json",
      directory: "/other/out",
    });
    expect(await locateModel(io, { config: "missing.yaml" })).toEqual({
      ok: false,
      lines: ["/work/missing.yaml: configuration file not found"],
    });
    io.fs.writeText("/work/concordance.yaml", "version: 1\n");
    expect(await locateModel(io, {})).toEqual({
      ok: false,
      lines: ["/work/concordance.yaml: invalid configuration; run concordance validate-config"],
    });
    io.fs.writeText("/work/concordance.yaml", validConfig);
    io.fs.writeText("/work/dist/model.json", '{"version": 2}');
    expect((await locateModel(io, {})).ok).toBe(false);
    const fresh = recordedIo({ "/work/concordance.yaml": validConfig });
    expect(await locateModel(fresh, {})).toEqual({
      ok: false,
      lines: ["/work/dist/model.json: model file not found; run concordance build first"],
    });
  });

  it("falls back to the published model of concordance-lint.yaml, as the linter reads it", async () => {
    const io = await built();
    const text = io.fs.readText("/work/dist/model.json");
    const repo = recordedIo(
      {
        "/repo/concordance-lint.yaml": "global: { model: ../work/dist/model.json }\n",
        "/work/dist/model.json": text,
      },
      "/repo",
    );
    expect(await locateModel(repo, {})).toMatchObject({
      ok: true,
      file: "/work/dist/model.json",
      origin: "published",
      directory: "/work/dist",
    });
    const remote = recordedIo(
      {
        "/repo/concordance-lint.yaml": "global: { model: https://wiki.example/model.json }\n",
      },
      "/repo",
    );
    const offline = await locateModel(remote, {});
    expect(offline.ok).toBe(false);
    expect(offline.ok ? "" : offline.lines[0]).toMatch(/^https:\/\/wiki\.example\/model\.json: /);
    const served = {
      ...remote,
      fetch: (() => Promise.resolve(new Response(text, { status: 200 }))) as typeof fetch,
    };
    expect(await locateModel(served, {})).toMatchObject({
      ok: true,
      origin: "published",
      file: "https://wiki.example/model.json",
    });
    expect(
      (await locateModel(served, {})).ok && "directory" in (await locateModel(served, {})),
    ).toBe(false);
    const noModel = recordedIo(
      { "/repo/concordance-lint.yaml": "global: { cache_dir: .cache }\n" },
      "/repo",
    );
    expect(await locateModel(noModel, {})).toEqual({
      ok: false,
      lines: ["concordance-lint.yaml: no global.model in concordance-lint.yaml"],
    });
    const nothing = recordedIo({ "/repo/concordance-lint.yaml": "checks: {}\n" }, "/repo");
    expect(await locateModel(nothing, {})).toEqual({
      ok: false,
      lines: [
        "no model to read: name one with --model, or run the command where concordance.yaml stands",
        "(looked for --model, /repo/concordance.yaml, and global.model in /repo/concordance-lint.yaml)",
      ],
    });
  });
});
