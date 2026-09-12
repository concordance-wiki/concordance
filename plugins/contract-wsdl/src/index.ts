import { definePlugin, PLUGIN_API_VERSION } from "@concordance-wiki/core";

import { loadContracts, SOURCE_KIND } from "./source.js";

export {
  isWsdlRoot,
  readWsdl,
  type WsdlContract,
  type WsdlOperation,
  type WsdlVersion,
} from "./contract.js";
export { loadContracts, SOURCE_KIND, STYLE, wsdlReader } from "./source.js";

export default definePlugin({
  name: "@concordance-wiki/plugin-contract-wsdl",
  version: "0.0.0",
  apiVersion: PLUGIN_API_VERSION,
  contributes: {
    sources: [{ kind: SOURCE_KIND, load: loadContracts }],
  },
});
