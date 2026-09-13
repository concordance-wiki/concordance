import { hydrate } from "preact";

import { CONTRACT_VIEWER_ISLAND, ContractViewer } from "../theme/default/contract-viewer.js";
import { mountIslands } from "./mount.js";

mountIslands(CONTRACT_VIEWER_ISLAND, ContractViewer, document, hydrate);
