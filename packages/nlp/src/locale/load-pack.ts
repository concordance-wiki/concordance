import { readFileSync } from "node:fs";

import { describeSchemaError, formatIssue, readSchema, type Locale } from "@concordance-wiki/core";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { parse } from "yaml";

import { normalizer } from "./normalize.js";
import type { LanguagePack, PluralRule, Word } from "./pack.js";
import { canonicalLocale } from "./tag.js";
import { loadStopwords } from "./stopwords.js";
import { loadSuffixes } from "./suffixes.js";

interface PackDocument {
  locale: string;
  language: string;
  apostrophes?: string[];
  collation: Intl.CollatorOptions;
  plural: { ending: string; singular: string; min_length?: number }[];
}

export class LanguagePackError extends Error {
  constructor(directory: string, detail: string) {
    super(`language pack at ${directory}: ${detail}`);
    this.name = "LanguagePackError";
  }
}

function readDocument(directory: URL): PackDocument {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile<PackDocument>(readSchema("language-pack"));
  const document: unknown = parse(readFileSync(new URL("pack.yaml", directory), "utf8"));
  if (!validate(document)) {
    // The validator fills `errors` whenever it returns false.
    const detail = (validate.errors as ErrorObject[])
      .map((error) => formatIssue(describeSchemaError(error, document), "pack.yaml"))
      .join("; ");
    throw new LanguagePackError(directory.pathname, detail);
  }
  // Validated against the schema the type mirrors.
  return document as PackDocument;
}

function canonical(tag: string, directory: URL): Locale {
  try {
    return canonicalLocale(tag);
  } catch {
    throw new LanguagePackError(directory.pathname, `"${tag}" is not a valid language tag`);
  }
}

/** The text of an optional file of the pack: an absent file reads as empty, any other failure is raised. */
function optionalText(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch (error) {
    // A node file system error carries its code; any other value has none and is rethrown.
    if ((error as { code?: unknown }).code === "ENOENT") return "";
    throw error;
  }
}

/**
 * Reads a language pack from a folder holding `pack.yaml` and `stopwords.txt`, and
 * `suffixes.txt` when the pack lists inflected-form suffixes. The core packs and the ones
 * shipped by plugins are read the same way.
 */
export function loadLanguagePack(directory: URL): LanguagePack {
  const base = directory.href.endsWith("/") ? directory : new URL(`${directory.href}/`);
  const document = readDocument(base);
  const locale = canonical(document.locale, base);
  const collator = new Intl.Collator(locale, document.collation);
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const normalize = normalizer(document.apostrophes ?? []);
  const plural: PluralRule[] = document.plural.map((rule) => ({
    ending: rule.ending,
    singular: rule.singular,
    minLength: rule.min_length ?? rule.ending.length + 1,
  }));
  return {
    locale,
    language: document.language,
    normalize,
    segment: (text): Word[] =>
      [...segmenter.segment(text)].map((part) => ({
        text: part.segment,
        index: part.index,
        isWordLike: part.isWordLike === true,
      })),
    stopwords: new Set(loadStopwords(readFileSync(new URL("stopwords.txt", base), "utf8"))),
    suffixes: new Set(loadSuffixes(optionalText(new URL("suffixes.txt", base)), normalize)),
    plural,
    collator,
    compare: (a, b) => collator.compare(a, b),
  };
}
