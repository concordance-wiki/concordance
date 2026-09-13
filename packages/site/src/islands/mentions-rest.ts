import type { Mention } from "../slots.js";
import { MENTIONS_EMBEDDED, type MentionsRest } from "../theme/default/mentions-island.js";

/** What the entry reads from the page: the JSON script block of the embedded mentions, when the panel wrote one. */
export interface MentionsDocument {
  getElementById(id: string): { textContent: string | null } | null;
}

export interface MentionsFragmentResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function isMention(value: unknown): value is Mention {
  return typeof value === "object" && value !== null && "kind" in value && "href" in value;
}

/** What an embedded block lists under `mentions`, when it is such a block. */
function embeddedList(value: unknown): unknown {
  return typeof value === "object" && value !== null && "mentions" in value
    ? value.mentions
    : undefined;
}

/** The mentions of a fragment or of the embedded block, refusing anything but a list of mentions. */
export function parseMentions(value: unknown): Mention[] {
  const list = Array.isArray(value) ? value : embeddedList(value);
  if (!Array.isArray(list) || !list.every(isMention)) {
    throw new Error("not a list of mentions");
  }
  return list;
}

/**
 * Where the mentions beyond the inline ones come from: the embedded block when the page carries
 * one, the fragment fetched on demand behind a server, a link to it over `file://`, where a page
 * may not fetch; nothing when every mention is inline.
 */
export function restOf(
  document: MentionsDocument,
  protocol: string,
  fragmentHref: string | undefined,
  fetchFragment: (href: string) => Promise<MentionsFragmentResponse>,
): MentionsRest | undefined {
  const embedded = document.getElementById(MENTIONS_EMBEDDED);
  if (embedded !== null) {
    return { kind: "embedded", mentions: parseMentions(JSON.parse(embedded.textContent ?? "")) };
  }
  if (fragmentHref === undefined) return undefined;
  if (protocol === "file:") return { kind: "link" };
  return {
    kind: "fetch",
    load: async () => {
      const response = await fetchFragment(fragmentHref);
      if (!response.ok) {
        throw new Error(`${fragmentHref}: HTTP ${String(response.status)}`);
      }
      return parseMentions(await response.json());
    },
  };
}
