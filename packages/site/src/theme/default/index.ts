import { h, type JSX } from "preact";

import type { EntityPageProps } from "../../slots.js";
import type { SlotComponents } from "../types.js";
import { About } from "./about.js";
import { CategoryList } from "./category-list.js";
import { TypedEntityPage } from "./api-page.js";
import { DecisionPage } from "./decision-page.js";
import { DocumentPage } from "./document-page.js";
import { Footer } from "./footer.js";
import { Header } from "./header.js";
import { Home } from "./home.js";
import { Index } from "./index-page.js";
import { KeywordPage } from "./keyword-page.js";
import { MeetingPage } from "./meeting-page.js";
import { MentionsPanel } from "./mentions-panel.js";
import { Neighbourhood } from "./neighbourhood.js";
import { NotFound } from "./not-found.js";
import { SearchResults } from "./search-results.js";
import { Shell } from "./shell.js";
import { Space } from "./space.js";
import { Spaces } from "./spaces.js";
import { Todo } from "./todo.js";

/**
 * The entity page of the default theme: the meeting template when the view model carries a
 * meeting, the document template when it carries a document, the decision template when it
 * carries a decision, the API template when it carries an imported contract, the generic
 * template otherwise.
 */
export function EntityPage(props: EntityPageProps): JSX.Element {
  if (props.meeting !== undefined) return h(MeetingPage, { ...props, meeting: props.meeting });
  if (props.document !== undefined) return h(DocumentPage, { ...props, document: props.document });
  if (props.decision !== undefined) return h(DecisionPage, { ...props, decision: props.decision });
  return h(TypedEntityPage, props);
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
  CategoryList,
  About,
  NotFound,
};
