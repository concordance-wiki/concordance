import {
  definePlugin,
  nodeFileSystem,
  PLUGIN_API_VERSION,
  type Converter,
  type FileSystem,
} from "@concordance-wiki/core";

import { convertToPdf } from "./convert.js";
import { extractPdfText } from "./pdf-text.js";
import { nodeCommandRunner, type CommandRunner } from "./runner.js";

export {
  convertToPdf,
  sha256Of,
  SOFFICE,
  SUSPECT_SOURCE_BYTES,
  type ConvertDependencies,
  type ConvertOptions,
  type ConvertSource,
} from "./convert.js";
export { extractPdfText } from "./pdf-text.js";
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
  extractText: (pdf: Uint8Array) => Promise<string>;
}

const nodeDependencies: ConverterDependencies = {
  runner: nodeCommandRunner,
  fs: nodeFileSystem,
  extractText: extractPdfText,
};

/** The converter contribution over the given effects; the plugin uses the Node ones. */
export function createConverter(deps: ConverterDependencies = nodeDependencies): Converter {
  return {
    extensions: [...OFFICE_EXTENSIONS],
    produces: ["pdf"],
    convert: (input) =>
      convertToPdf(
        { path: input.path, bytes: input.payload.bytes, sha256: input.payload.sha256 },
        {
          extensions: OFFICE_EXTENSIONS,
          timeoutMs: input.payload.options.timeoutMs,
          maxSizeBytes: input.payload.options.maxSizeBytes,
        },
        { ...deps, cacheDirectory: input.payload.cacheDirectory },
      ),
  };
}

export default definePlugin({
  name: "@concordance-wiki/plugin-convert-libreoffice",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  systemDependencies: [{ name: "LibreOffice", check: "soffice" }],
  contributes: { converters: [createConverter()] },
});
