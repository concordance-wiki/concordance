import { shardHref } from "../search/shared.js";

/** Adds a classic script to the page and says whether it loaded; a missing shard is an error, not a failure. */
export type ScriptInjector = (src: string, done: (loaded: boolean) => void) => void;

/** The callback every index file calls with its name and its data. */
export interface ShardReceiver {
  shard(name: string, data: unknown): void;
}

/** The window, as far as the loader needs it: the global the index files call back. */
export interface ShardHost {
  __concordanceSearch?: ShardReceiver;
}

declare global {
  interface Window {
    __concordanceSearch?: ShardReceiver;
  }
}

/** Loads an index file once, whatever the number of callers, through a script the browser accepts over `file://`. */
export type ShardLoader = (name: string) => Promise<unknown>;

/**
 * The loader of the index files of one page: each file is a classic script calling
 * `window.__concordanceSearch.shard(name, data)`, so the loader exposes that global, injects
 * the script, and resolves when the callback comes; a script that fails to load resolves to
 * nothing. Loaded files are kept, so that a prefix typed again costs no request.
 */
export function shardLoader(index: string, inject: ScriptInjector, host: ShardHost): ShardLoader {
  const loaded = new Map<string, Promise<unknown>>();
  const pending = new Map<string, (data: unknown) => void>();
  host.__concordanceSearch = {
    shard: (name, data) => {
      pending.get(name)?.(data);
      pending.delete(name);
    },
  };
  return (name) => {
    const known = loaded.get(name);
    if (known !== undefined) {
      return known;
    }
    const promise = new Promise<unknown>((resolve) => {
      pending.set(name, resolve);
      inject(shardHref(index, name), (ok) => {
        if (!ok) {
          pending.delete(name);
          resolve(undefined);
        }
      });
    });
    loaded.set(name, promise);
    return promise;
  };
}
