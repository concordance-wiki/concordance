import { join } from "node:path";

import {
  contractPathIn,
  cachedContractViewPath,
  canonicalJson,
  readCachedContractView,
  type ContractRecord,
  type Entity,
  type FileSystem,
} from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import {
  contractFileTarget,
  contractFragmentPath,
  fragmentImagePath,
  isContractUrl,
} from "@concordance-wiki/site";

export interface ContractFragmentsInput {
  /** The records the source plugins left, one per imported contract. */
  contracts: readonly ContractRecord[];
  /** The entities of the model; the api note of each record says where a path contract resolves from. */
  entities: readonly Entity[];
  sources: readonly IngestedSource[];
  cacheDirectory: string;
  fs: FileSystem;
}

export interface ContractFragmentsWritten {
  /** Views copied from the contract cache as `fragments/<api id>.contract.json`. */
  fragments: number;
  /** Path contracts kept under `fragments/` at their target next to the page, for the download link. */
  files: number;
}

/** The absolute path of a contract declared as a path, from the folder of the api note that declares it. */
function contractFile(
  record: ContractRecord,
  entities: readonly Entity[],
  sources: readonly IngestedSource[],
): string | undefined {
  const api = entities.find((entity) => entity.id === record.api);
  const root = sources.find((source) => source.name === api?.source.name)?.root;
  if (api === undefined || root === undefined) return undefined;
  // The same bound as the loader: a contract outside its source is never copied under the output.
  const located = contractPathIn(root, api.source.path, record.location);
  return "reason" in located ? undefined : located.path;
}

/**
 * Writes what the api pages show of their contracts, next to the entity fragments so that
 * `render` needs no cache and no source: the view the contract loader cached, as canonical JSON
 * under `fragments/<api id>.contract.json`, and the copy of a path contract under `fragments/` at
 * the target the page links to. A URL contract is downloaded from its URL and is not copied.
 */
export function writeContractFragments(
  input: ContractFragmentsInput,
  output: string,
): ContractFragmentsWritten {
  const { fs } = input;
  let fragments = 0;
  let files = 0;
  for (const record of input.contracts) {
    const view = readCachedContractView(
      fs,
      cachedContractViewPath(input.cacheDirectory, record.fingerprint),
    );
    if (view !== undefined) {
      fs.writeText(join(output, contractFragmentPath(record.api)), canonicalJson(view));
      fragments += 1;
    }
    if (isContractUrl(record.location)) continue;
    const file = contractFile(record, input.entities, input.sources);
    if (file === undefined || !fs.exists(file)) continue;
    const target = fragmentImagePath(contractFileTarget(record.api, record.location));
    fs.writeBytes(join(output, target), fs.readBytes(file));
    files += 1;
  }
  return { fragments, files };
}
