import type { GalleryPage } from "./page.js";
import { shellRtlState } from "./states/shell-rtl.js";
import { headerLogoState } from "./states/header-logo.js";
import { footerTextState } from "./states/footer-text.js";
import { homeState } from "./states/home.js";
import { entityPageState } from "./states/entity-page.js";
import { entityPageCorporateState } from "./states/entity-page-corporate.js";
import { entityPageEmptyState } from "./states/entity-page-empty.js";
import { entityPageDocumentState } from "./states/entity-page-document.js";
import { entityPageContractState } from "./states/entity-page-contract.js";
import { entityPagePhoneState } from "./states/entity-page-phone.js";
import { entityPageDrawerState } from "./states/entity-page-drawer.js";
import { entityPageTabletState } from "./states/entity-page-tablet.js";
import { entityPageMapState } from "./states/entity-page-map.js";
import { keywordPageState } from "./states/keyword-page.js";
import { keywordPageEmptyState } from "./states/keyword-page-empty.js";
import { mentionsPanelState } from "./states/mentions-panel.js";
import { mentionsPanelEmptyState } from "./states/mentions-panel-empty.js";
import { mentionsPanelIslandState } from "./states/mentions-panel-island.js";
import { neighbourhoodState } from "./states/neighbourhood.js";
import { neighbourhoodFullState } from "./states/neighbourhood-full.js";
import { neighbourhoodOverflowState } from "./states/neighbourhood-overflow.js";
import { neighbourhoodEmptyState } from "./states/neighbourhood-empty.js";
import { searchResultsState } from "./states/search-results.js";
import { searchResultsEmptyState } from "./states/search-results-empty.js";
import { indexPageState } from "./states/index-page.js";
import { todoState } from "./states/todo.js";
import { todoEmptyState } from "./states/todo-empty.js";
import { keywordPageCorporateState } from "./states/keyword-page-corporate.js";
import { homeCorporateState } from "./states/home-corporate.js";
import { searchResultsCorporateState } from "./states/search-results-corporate.js";
import { indexCorporateState } from "./states/index-corporate.js";
import { screenPageCorporateState } from "./states/screen-page-corporate.js";
import { spacesCorporateState } from "./states/spaces-corporate.js";
import { spaceCorporateState } from "./states/space-corporate.js";
import { meetingPageCorporateState } from "./states/meeting-page-corporate.js";
import { categoryCorporateState } from "./states/category-corporate.js";
import { apiPageCorporateState } from "./states/api-page-corporate.js";
import { documentPageCorporateState } from "./states/document-page-corporate.js";

export type { GalleryPage } from "./page.js";

/** Every page of the gallery, one state file each, in the order of the slots then of the states. */
export const galleryPages: readonly GalleryPage[] = [
  shellRtlState,
  headerLogoState,
  footerTextState,
  homeState,
  entityPageState,
  entityPageCorporateState,
  entityPageEmptyState,
  entityPageDocumentState,
  entityPageContractState,
  entityPagePhoneState,
  entityPageDrawerState,
  entityPageTabletState,
  entityPageMapState,
  keywordPageState,
  keywordPageEmptyState,
  mentionsPanelState,
  mentionsPanelEmptyState,
  mentionsPanelIslandState,
  neighbourhoodState,
  neighbourhoodFullState,
  neighbourhoodOverflowState,
  neighbourhoodEmptyState,
  searchResultsState,
  searchResultsEmptyState,
  indexPageState,
  todoState,
  todoEmptyState,
  keywordPageCorporateState,
  homeCorporateState,
  searchResultsCorporateState,
  indexCorporateState,
  screenPageCorporateState,
  spacesCorporateState,
  spaceCorporateState,
  meetingPageCorporateState,
  categoryCorporateState,
  apiPageCorporateState,
  documentPageCorporateState,
];
