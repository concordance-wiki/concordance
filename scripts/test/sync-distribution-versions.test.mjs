import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { syncDistributionVersions } from "../sync-distribution-versions.mjs";

const repository = join(import.meta.dirname, "../..");
const manifests = [
  "distribution/github-action/action.yml",
  "distribution/gitlab-component/templates/lint.yml",
  ".pre-commit-hooks.yaml",
];
const roots = [];

/** A copy of the three manifests next to a packages/cli manifest at the given version. */
function repositoryAt(version) {
  const root = mkdtempSync(join(tmpdir(), "concordance-sync-"));
  roots.push(root);
  for (const file of manifests) cpSync(join(repository, file), join(root, file));
  mkdirSync(join(root, "packages/cli"), { recursive: true });
  writeFileSync(
    join(root, "packages/cli/package.json"),
    JSON.stringify({ name: "@concordance-wiki/cli", version }),
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("syncDistributionVersions", () => {
  it("pins the action, the component and the hook to the version of packages/cli", () => {
    const root = repositoryAt("1.2.3");
    expect(syncDistributionVersions(root)).toBe("1.2.3");
    const action = readFileSync(join(root, manifests[0]), "utf8");
    const component = readFileSync(join(root, manifests[1]), "utf8");
    const hooks = readFileSync(join(root, manifests[2]), "utf8");
    expect(action).toMatch(/\n {2}version:\n(?: {4}.*\n)*? {4}default: "1\.2\.3"/u);
    expect(component).toMatch(/\n {4}version:\n(?: {6}.*\n)*? {6}default: "1\.2\.3"/u);
    expect(hooks).toContain('additional_dependencies: ["@concordance-wiki/cli@1.2.3"]');
    expect(action).not.toContain("0.0.0");
    expect(component).not.toContain("0.0.0");
    expect(hooks).not.toContain("0.0.0");
  });

  it("keeps a prerelease suffix in the pins", () => {
    const root = repositoryAt("0.2.0-rc.1");
    expect(syncDistributionVersions(root)).toBe("0.2.0-rc.1");
    expect(readFileSync(join(root, manifests[2]), "utf8")).toContain(
      "@concordance-wiki/cli@0.2.0-rc.1",
    );
  });

  it("leaves the manifests as they are when they already pin the version", () => {
    const root = repositoryAt("1.2.3");
    syncDistributionVersions(root);
    const before = manifests.map((file) => readFileSync(join(root, file), "utf8"));
    syncDistributionVersions(root);
    expect(manifests.map((file) => readFileSync(join(root, file), "utf8"))).toEqual(before);
  });

  it("fails when a manifest has no version pin to rewrite", () => {
    const root = repositoryAt("1.2.3");
    writeFileSync(join(root, manifests[2]), "- id: concordance-lint\n  language: node\n");
    expect(() => syncDistributionVersions(root)).toThrow("the version pin was not found");
  });

  it("fails when a manifest stays unsound once pinned", () => {
    const root = repositoryAt("1.2.3");
    const hooks = readFileSync(join(root, manifests[2]), "utf8");
    writeFileSync(
      join(root, manifests[2]),
      hooks.replace("pass_filenames: false", "pass_filenames: true"),
    );
    expect(() => syncDistributionVersions(root)).toThrow("hook pass_filenames must be false");
  });
});
