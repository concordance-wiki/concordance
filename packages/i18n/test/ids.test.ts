import { describe, expect, expectTypeOf, it } from "vitest";

import { formatMessage, loadCatalogue } from "../src/catalogue.js";
import {
  argumentNames,
  messageArguments,
  messageIds,
  type ArgumentValues,
  type MessageArguments,
  type MessageId,
} from "../src/ids.js";
import fr from "../messages/fr.json" with { type: "json" };

type Declared = typeof messageArguments;

/** The identifiers whose runtime declaration lists at least one argument. */
type WithArguments = {
  [Id in MessageId]: keyof Declared[Id] extends never ? never : Id;
}[MessageId];

/** The argument object the runtime declaration of an identifier implies. */
type ImpliedArguments<Id extends MessageId> = {
  -readonly [Name in keyof Declared[Id]]: Declared[Id][Name] extends keyof ArgumentValues
    ? ArgumentValues[Declared[Id][Name]]
    : never;
};

/** The identifiers whose hand-written interface disagrees with the runtime declaration. */
type Mismatches = {
  [Id in keyof MessageArguments]: [MessageArguments[Id]] extends [ImpliedArguments<Id>]
    ? [ImpliedArguments<Id>] extends [MessageArguments[Id]]
      ? never
      : Id
    : Id;
}[keyof MessageArguments];

describe("message identifiers", () => {
  it("are typed from the source catalogue, so an unknown identifier does not compile", () => {
    const catalogue = loadCatalogue("en");
    // @ts-expect-error -- the identifier is not in the source catalogue
    expect(() => formatMessage(catalogue, "site.nowhere")).toThrow();
    expectTypeOf<MessageId>().toEqualTypeOf<keyof typeof fr>();
  });

  it("require every variable of a message and refuse a variable it does not declare", () => {
    const catalogue = loadCatalogue("en");
    // @ts-expect-error -- the message takes a count
    expect(() => formatMessage(catalogue, "entity.mentionsCount")).toThrow();
    // @ts-expect-error -- the message takes a count, not a total
    expect(() => formatMessage(catalogue, "entity.mentionsCount", { total: 2 })).toThrow();
    // @ts-expect-error -- the message takes no argument
    expect(formatMessage(catalogue, "site.home", { extra: 1 })).toBe("Home");
    expect(formatMessage(catalogue, "entity.mentionsCount", { count: 2 })).toBe("2 mentions");
  });

  it("declare in the interface exactly the identifiers that take arguments, with the kinds' types", () => {
    expectTypeOf<keyof MessageArguments>().toEqualTypeOf<WithArguments>();
    expectTypeOf<Mismatches>().toEqualTypeOf<never>();
    expectTypeOf<MessageArguments["site.generatedAt"]>().toEqualTypeOf<{ date: Date }>();
    expectTypeOf<MessageArguments["mentions.inSection"]>().toEqualTypeOf<{ section: string }>();
    expect(Object.keys(messageArguments).sort()).toEqual([...messageIds]);
  });

  it("expose the argument names of every identifier for the catalogue checks", () => {
    expect(argumentNames["entity.mentionsCount"]).toEqual(["count"]);
    expect(argumentNames["site.home"]).toEqual([]);
    expect(Object.keys(argumentNames)).toEqual([...messageIds]);
  });
});
