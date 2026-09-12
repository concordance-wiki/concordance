import { definePlugin, PLUGIN_API_VERSION } from "@concordance-wiki/core";

import { loadContracts, SOURCE_KIND } from "./source.js";

export {
  cachedContractPath,
  fingerprintOf,
  readCachedContract,
  writeCachedContract,
} from "./cache.js";
export {
  HTTP_METHODS,
  readOpenApi,
  type ContractError,
  type HttpMethod,
  type OpenApiContract,
  type OpenApiOperation,
} from "./contract.js";
export {
  CHECK_UNREACHABLE,
  declaredContracts,
  DEFAULT_CONFIDENCE,
  loadContracts,
  METHOD,
  RELATION,
  SOURCE_KIND,
} from "./source.js";

export default definePlugin({
  name: "@concordance-wiki/plugin-contract-openapi",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  contributes: {
    sources: [{ kind: SOURCE_KIND, load: loadContracts }],
  },
});
