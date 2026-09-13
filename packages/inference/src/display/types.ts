import type { Link } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

/** What the displayed neighbourhood needs of a node: a keyword page is a noteless word. */
export interface DisplayableEntity {
  id: string;
  type: string;
  title: string;
  keyword?: boolean;
}

export type NeighbourKind = "entity" | "keyword";

/** Where the links between the node and its neighbour point, seen from the node. */
export type NeighbourDirection = "out" | "in" | "both";

/** One node of the mini-map, as serialised under `displayed_neighbourhood` in `model.json`. */
export interface DisplayedNeighbour {
  id: string;
  title: string;
  type: string;
  kind: NeighbourKind;
  /** The relation of the most confident link, the first in code-unit order on a tie. */
  relation: string;
  direction: NeighbourDirection;
  /** The largest confidence over the links between the two nodes. */
  confidence: number;
  /**
   * The position of the neighbour's type in the `display.neighbours_order` of the page's type;
   * a type not listed, a keyword page included, ranks after every listed one, at the length of
   * the list. Neighbours are grouped by rank, so a change of rank separates two priority groups.
   */
  rank: number;
}

export interface DisplayedNeighbourhoodInput {
  entities: readonly DisplayableEntity[];
  links: readonly Link[];
  /** Where the priority order of neighbour types comes from, per type of the page. */
  profile: Profile;
  /** Nodes shown per page; the computation never shows more than `MAX_DISPLAYED_NEIGHBOURS`. */
  size: number;
}

/** Every entity in identifier order, each with its neighbours in priority order, empty when it has none. */
export type DisplayedNeighbourhood = ReadonlyMap<string, DisplayedNeighbour[]>;

export interface DisplayOptions {
  size: number;
}
