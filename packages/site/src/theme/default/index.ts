import { h, type JSX } from "preact";

import type { EntityPageProps } from "../../slots.js";
import type { SlotComponents } from "../types.js";
import { EntityPage as GenericEntityPage } from "./entity-page.js";
import { Footer } from "./footer.js";
import { Header } from "./header.js";
import { Home } from "./home.js";
import { Index } from "./index-page.js";
import { KeywordPage } from "./keyword-page.js";
import { MeetingPage } from "./meeting-page.js";
import { MentionsPanel } from "./mentions-panel.js";
import { Neighbourhood } from "./neighbourhood.js";
import { SearchResults } from "./search-results.js";
import { Shell } from "./shell.js";
import { Space } from "./space.js";
import { Spaces } from "./spaces.js";
import { Todo } from "./todo.js";

/** The entity page of the default theme: the meeting template when the view model carries a meeting, the generic template otherwise. */
export function EntityPage(props: EntityPageProps): JSX.Element {
  return props.meeting === undefined
    ? h(GenericEntityPage, props)
    : h(MeetingPage, { ...props, meeting: props.meeting });
}

/** The default theme: one component per slot. */
export const defaultComponents: SlotComponents = {
  Shell,
  Header,
  Footer,
  Home,
  EntityPage,
  KeywordPage,
  MentionsPanel,
  Neighbourhood,
  SearchResults,
  Index,
  Todo,
  Spaces,
  Space,
};
