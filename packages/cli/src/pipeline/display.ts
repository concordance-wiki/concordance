import type { Config, DisplayedNeighbourhood, Entity, Link } from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";
import {
  displayedNeighbourhood,
  displayedNeighbourhoodToModel,
  displayOptions,
} from "@concordance-wiki/inference";

export interface DisplayedNeighbourhoodInput {
  entities: readonly Entity[];
  links: readonly Link[];
  config: Config;
  profile: Profile;
}

/** The `displayed_neighbourhood` block: the one-hop neighbours shown on every page, best first. */
export function displayedNeighbourhoodBlock(
  input: DisplayedNeighbourhoodInput,
): DisplayedNeighbourhood {
  return displayedNeighbourhoodToModel(
    displayedNeighbourhood({
      entities: input.entities,
      links: input.links,
      profile: input.profile,
      size: displayOptions(input.config.site).size,
    }),
  );
}
