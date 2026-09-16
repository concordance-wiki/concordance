import { describe, expect, it } from "vitest";

import { resolveExpression } from "../../src/query/resolve.js";
import { entity, model } from "./fixture.js";

const page = entity("glossary/keyword-page", { title: "Keyword page", aliases: ["word page"] });
const screen = entity("specs/screens/keyword-page", { title: "Keyword page", type: "screen" });
const object = entity("specs/objects/keyword-page", {
  title: "Keyword page",
  type: "business_object",
});
const keyword = entity("keywords/key", { title: "key", keyword: true });
const cafe = entity("glossary/cafe", { title: "Café" });

describe("resolveExpression reads an expression the way the recognition does", () => {
  it("takes an identifier as written before anything else", () => {
    expect(resolveExpression(model([page, screen]), "specs/screens/keyword-page")).toEqual({
      entity: screen,
    });
  });

  it("takes a title or an alias as written, and the term when several notes carry the same title", () => {
    expect(resolveExpression(model([screen, page, object]), "Keyword page")).toEqual({
      entity: page,
    });
    expect(resolveExpression(model([page]), "word page")).toEqual({ entity: page });
  });

  it("lists the candidates when no term, or several terms, carry the written form", () => {
    expect(resolveExpression(model([screen, object]), "Keyword page")).toEqual({
      candidates: [screen, object],
    });
    const twin = entity("glossary/other/keyword-page", { title: "Keyword page" });
    expect(resolveExpression(model([page, twin]), "Keyword page")).toEqual({
      candidates: [page, twin],
    });
  });

  it("compares without case, accents and inflections when nothing is written that way", () => {
    expect(resolveExpression(model([screen, page]), "Keyword Pages")).toEqual({ entity: page });
    expect(resolveExpression(model([cafe]), "cafe")).toEqual({ entity: cafe });
  });

  it("falls back to a prefix of the forms, one entity or the candidates", () => {
    expect(resolveExpression(model([cafe, page]), "caf")).toEqual({ entity: cafe });
    expect(resolveExpression(model([screen, object]), "keyw")).toEqual({
      candidates: [screen, object],
    });
  });

  it("never prefers a keyword page over a note, and finds nothing for a form no entity starts with", () => {
    const note = entity("specs/screens/key", { title: "key", type: "screen" });
    expect(resolveExpression(model([keyword, note]), "key")).toEqual({
      candidates: [keyword, note],
    });
    expect(resolveExpression(model([page]), "zzz")).toEqual({ candidates: [] });
  });
});
