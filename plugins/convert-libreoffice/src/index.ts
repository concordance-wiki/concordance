import {
  definePlugin,
  nodeFileSystem,
  PLUGIN_API_VERSION,
  type Converter,
  type FileSystem,
} from "@concordance-wiki/core";

import { convertToPdf, PDF_EXTENSION } from "./convert.js";
import { extractPdfPages } from "./pdf-text.js";
import { nodeCommandRunner, type CommandRunner } from "./runner.js";

export {
  convertToPdf,
  extractedTextPath,
  PDF_EXTENSION,
  sha256Of,
  SOFFICE,
  SUSPECT_SOURCE_BYTES,
  type ConvertDependencies,
  type ConvertOptions,
  type ConvertSource,
  type ExtractedText,
} from "./convert.js";
export { extractPdfPages, extractPdfText } from "./pdf-text.js";
export { convertMany } from "./pool.js";
export {
  nodeCommandRunner,
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
} from "./runner.js";

export const OFFICE_EXTENSIONS: readonly string[] = [".docx", ".pptx", ".xlsx"];

export interface ConverterDependencies {
  runner: CommandRunner;
  fs: FileSystem;
  extractPages: (pdf: Uint8Array) => Promise<string[]>;
}

const nodeDependencies: ConverterDependencies = {
  runner: nodeCommandRunner,
  fs: nodeFileSystem,
  extractPages: extractPdfPages,
};

function converterFor(extensions: readonly string[], deps: ConverterDependencies): Converter {
  return {
    extensions: [...extensions],
    produces: ["pdf", "text"],
    convert: (input) =>
      convertToPdf(
        { path: input.path, bytes: input.payload.bytes, sha256: input.payload.sha256 },
        {
          extensions,
          timeoutMs: input.payload.options.timeoutMs,
          maxSizeBytes: input.payload.options.maxSizeBytes,
        },
        { ...deps, cacheDirectory: input.payload.cacheDirectory },
      ),
  };
}

/** The office converter contribution over the given effects; the plugin uses the Node ones. */
export function createConverter(deps: ConverterDependencies = nodeDependencies): Converter {
  return converterFor(OFFICE_EXTENSIONS, deps);
}

/**
 * The PDF contribution: a PDF source needs no LibreOffice, it is kept as its own PDF
 * representation and its text is extracted through the same path as a converted document.
 */
export function createPdfConverter(deps: ConverterDependencies = nodeDependencies): Converter {
  return converterFor([PDF_EXTENSION], deps);
}

export default definePlugin({
  name: "@concordance-wiki/plugin-convert-libreoffice",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  // Optional: a PDF source needs no LibreOffice, and an office document without it is a finding, not a silent loss.
  systemDependencies: [{ name: "LibreOffice", check: "soffice", optional: true }],
  contributes: { converters: [createConverter(), createPdfConverter()] },
});
