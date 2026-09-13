import type { SlotComponents } from "../types.js";
import { EntityPage } from "./entity-page.js";
import { Footer } from "./footer.js";
import { Header } from "./header.js";
import { Home } from "./home.js";
import { Index } from "./index-page.js";
import { KeywordPage } from "./keyword-page.js";
import { MentionsPanel } from "./mentions-panel.js";
import { Neighbourhood } from "./neighbourhood.js";
import { SearchResults } from "./search-results.js";
import { Shell } from "./shell.js";
import { Space } from "./space.js";
import { Spaces } from "./spaces.js";
import { Todo } from "./todo.js";

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
