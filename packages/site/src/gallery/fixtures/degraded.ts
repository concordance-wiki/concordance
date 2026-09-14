/*
 * The degraded cases of the corpus, each derived from the corporate fixture of its page: what
 * the pages show when a datum the boards count on is missing.
 */
import type { Mention, Passage, PassageGroup, SlotProps } from "../../slots.js";
import { corporateApiPage } from "./api-page.js";
import { corporateHeader } from "./chrome.js";
import { corporateEntityPage } from "./entity-page.js";
import { corporateHome } from "./home.js";
import { corporateKeywordPage } from "./keyword-page.js";

/** The top bar of a corpus fed by one repository: one space in the drawer. */
export const singleSourceHeader: SlotProps["Header"] = {
  ...corporateHeader,
  spaces: {
    label: "Spaces",
    href: "../spaces/",
    items: [{ label: "glossary", href: "../glossary/", initials: "GL", count: 48 }],
  },
};

/** The home page of a corpus fed by one repository: one space, its own changes, nothing folded and no alert. */
export const singleSourceHome: SlotProps["Home"] = {
  ...corporateHome,
  spaces: corporateHome.spaces.slice(0, 1),
  moreSpaces: [],
  recent: corporateHome.recent.filter((entry) => entry.space === "glossary"),
  alerts: [],
};

/** The rule of the corporate state written without any frontmatter beyond its type: nothing to put forward, nothing in the properties block. */
export const entityPageWithoutProperty: SlotProps["EntityPage"] = {
  ...corporateEntityPage,
  highlights: [],
  attributes: [],
  otherAttributes: [],
};

/** Whether a position is the timecode of a transcript cue rather than a page or a line. */
function isTimecode(location: string | undefined): boolean {
  return location !== undefined && /^\d{1,2}:\d{2}/.test(location);
}

function withoutTimecode(passage: Passage): Passage {
  if (!isTimecode(passage.location)) return passage;
  const bare = { ...passage };
  delete bare.location;
  return bare;
}

function groupWithoutTimecode(group: PassageGroup): PassageGroup {
  return {
    ...group,
    passages: group.passages.map(withoutTimecode),
    ...(group.folded === undefined
      ? {}
      : { folded: { ...group.folded, passages: group.folded.passages.map(withoutTimecode) } }),
  };
}

function mentionWithoutTimecode(mention: Mention): Mention {
  if (!isTimecode(mention.location)) return mention;
  const bare = { ...mention };
  delete bare.location;
  return bare;
}

/** The keyword page whose transcript passages carry no timecode, the reader of the transcript having given none: the line stands for each. */
export const keywordPageWithoutTimecode: SlotProps["KeywordPage"] = {
  ...corporateKeywordPage,
  passages: corporateKeywordPage.passages.map(groupWithoutTimecode),
  mentions: {
    ...corporateKeywordPage.mentions,
    mentions: corporateKeywordPage.mentions.mentions.map(mentionWithoutTimecode),
  },
};

/**
 * The API page when the contract its note points at could not be fetched: no contract record in
 * the model, the page falls back to the generic layout and its panel shows every declared key.
 * The application is named without the tool, the white-label check reading every visible value.
 */
export const apiPageWithoutContract: SlotProps["EntityPage"] = {
  ...corporateApiPage,
  attributes: corporateApiPage.attributes.map((attribute) =>
    attribute.name === "application"
      ? { ...attribute, values: [{ text: "query-service" }] }
      : attribute,
  ),
};
delete apiPageWithoutContract.contract;
