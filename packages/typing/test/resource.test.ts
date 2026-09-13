import type { Config } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { typeSources } from "../src/index.js";
import { buildResourceEntity, resourceAttributes } from "../src/resource.js";
import { APPLICATIONS, compiled, DOMAINS, file, profile, source, sourceConfig } from "./helpers.js";

const config: Config = {
  version: 1,
  project: { name: "Wiki" },
  applications: APPLICATIONS,
  domains: DOMAINS,
  sources: [
    sourceConfig({
      name: "specs",
      application: "concordance-cli",
      rules: [{ match: { ext: [".vtt", ".srt"] }, set: { type: "meeting", zone: "workshops" } }],
    }),
  ],
};

describe("buildResourceEntity", () => {
  it("builds a document entity whose identifier keeps the extension, titled by the reader's title", () => {
    const built = buildResourceEntity({
      file: file("meetings/link-keywords/Threshold Review.pptx", "abc123"),
      source: source("specs", []),
      sourceConfig: sourceConfig({ name: "specs", application: "concordance-cli" }),
      resource: {
        format: "pptx",
        metadata: {
          title: " Keyword page threshold review ",
          author: "Participant-1",
          created: "2026-03-10T09:00:00Z",
          modified: "2026-03-12T09:30:00Z",
          slides: 12,
          slideTitles: ["Agenda", "Threshold"],
          application: "Impress",
        },
      },
      profile: profile(),
      applications: APPLICATIONS,
      domains: compiled(),
    });
    expect(built.findings).toEqual([]);
    expect(built.entity).toEqual({
      id: "specs/meetings/link-keywords/threshold-review.pptx",
      type: "document",
      title: "Keyword page threshold review",
      aliases: [],
      locale: "en",
      application: "concordance-cli",
      domain: "inference/recognition",
      status: "draft",
      type_origin: "source",
      graph: "documents-only",
      attributes: {
        author: "Participant-1",
        created: "2026-03-10T09:00:00Z",
        date: "2026-03-12T09:30:00Z",
        format: "pptx",
        modified: "2026-03-12T09:30:00Z",
        producer: "Impress",
        slideTitles: ["Agenda", "Threshold"],
        slides: 12,
      },
      source: {
        name: "specs",
        path: "meetings/link-keywords/Threshold Review.pptx",
        line: 1,
        last_modified: "2026-03-12T10:00:00.000Z",
        commit: "abc123",
      },
    });
  });

  it("falls back to the file name as the title when the reader knows none or a blank one", () => {
    const build = (metadata: Record<string, unknown>) =>
      buildResourceEntity({
        file: file("framing/vision.pdf"),
        source: source("specs", []),
        sourceConfig: sourceConfig({ name: "specs", application: "concordance-cli" }),
        resource: { format: "pdf", metadata },
        profile: profile(),
        applications: APPLICATIONS,
        domains: compiled(),
      }).entity;
    expect(build({}).title).toBe("vision");
    expect(build({ title: "  " }).title).toBe("vision");
    expect(build({ title: 4 }).title).toBe("vision");
    expect(build({}).attributes).toEqual({ format: "pdf" });
  });

  it("types a resource through the source rules, ext matches included, and keeps the rule's other values as attributes", () => {
    const built = buildResourceEntity({
      file: file("meetings/neighbourhood-cap.vtt"),
      source: source("specs", []),
      sourceConfig: config.sources[0] ?? sourceConfig(),
      resource: {
        format: "vtt",
        metadata: { duration: 1800, speakers: ["Participant-1", "Participant-2"] },
      },
      profile: profile(),
      applications: APPLICATIONS,
      domains: compiled(),
    });
    expect(built.entity.type).toBe("meeting");
    expect(built.entity.type_origin).toBe("rule#1");
    expect(built.entity.attributes).toEqual({
      duration: 1800,
      format: "vtt",
      speakers: ["Participant-1", "Participant-2"],
      zone: "workshops",
    });
  });

  it("reports the filing findings of a resource like those of a note", () => {
    const built = buildResourceEntity({
      file: file("decks/roadmap.pptx"),
      source: source("specs", []),
      sourceConfig: sourceConfig({ name: "specs" }),
      resource: { format: "pptx", metadata: {} },
      profile: profile(),
      applications: APPLICATIONS,
      domains: compiled(),
    });
    expect(built.entity.application).toBeUndefined();
    expect(built.findings.map((finding) => [finding.check, finding.entity])).toEqual([
      ["W-APP-MISSING", "specs/decks/roadmap.pptx"],
      ["W-DOMAIN-UNCLASSIFIED", "specs/decks/roadmap.pptx"],
    ]);
  });

  it("falls back to the document type with a finding when a rule names a type the profile lacks", () => {
    const built = buildResourceEntity({
      file: file("decks/roadmap.pptx"),
      source: source("specs", []),
      sourceConfig: sourceConfig({
        name: "specs",
        application: "concordance-cli",
        rules: [{ match: { ext: [".pptx"] }, set: { type: "deck" } }],
      }),
      resource: { format: "pptx", metadata: {} },
      profile: profile(),
      applications: APPLICATIONS,
      domains: compiled(),
    });
    expect(built.entity.type).toBe("document");
    expect(built.findings.map((finding) => finding.check)).toEqual([
      "W-TYPE-UNKNOWN",
      "W-DOMAIN-UNCLASSIFIED",
    ]);
  });

  it("keeps the graph mode of the profile type and full for a type without one", () => {
    const built = (types: Profile["types"]) =>
      buildResourceEntity({
        file: file("decks/roadmap.pptx"),
        source: source("specs", []),
        sourceConfig: sourceConfig({ name: "specs", application: "concordance-cli" }),
        resource: { format: "pptx", metadata: {} },
        profile: profile({ types: { ...profile().types, ...types } }, false),
        applications: APPLICATIONS,
        domains: compiled(),
      }).entity;
    expect(built({}).graph).toBe("documents-only");
    expect(built({ document: { label: { en: "Document" }, group: "source" } }).graph).toBe("full");
    expect(built({}).status).toBe("valid");
  });
});

describe("resourceAttributes", () => {
  it("lets a date set by a rule stand over the document's own dates", () => {
    expect(
      resourceAttributes(
        { format: "docx", metadata: { created: "2026-01-01", modified: "2026-02-02" } },
        { date: "2026-03-03", application: "ignored" },
      ),
    ).toEqual({
      created: "2026-01-01",
      date: "2026-03-03",
      format: "docx",
      modified: "2026-02-02",
    });
  });

  it("takes the creation date when the document was never modified, and none when it states no date", () => {
    expect(resourceAttributes({ format: "docx", metadata: { created: "2026-01-01" } }, {})).toEqual(
      {
        created: "2026-01-01",
        date: "2026-01-01",
        format: "docx",
      },
    );
    expect(resourceAttributes({ format: "docx", metadata: { modified: 5 } }, {})).toEqual({
      format: "docx",
      modified: 5,
    });
  });
});

describe("typeSources with resources", () => {
  it("builds one entity per note and per known resource, and skips the files nobody knows", () => {
    const result = typeSources({
      sources: [
        source("specs", [
          file("decks/kickoff.pptx"),
          file("diagram.png"),
          file("meetings/review.vtt"),
          file("notes.md"),
        ]),
      ],
      documents: new Map(),
      resources: new Map([
        ["specs/decks/kickoff.pptx", { format: "pptx", metadata: { title: "Kickoff" } }],
        ["specs/meetings/review.vtt", { format: "vtt", metadata: {} }],
      ]),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.id, entity.type, entity.title])).toEqual([
      ["specs/decks/kickoff.pptx", "document", "Kickoff"],
      ["specs/meetings/review.vtt", "meeting", "review"],
    ]);
  });
});
