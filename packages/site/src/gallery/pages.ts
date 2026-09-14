import type { GalleryPage } from "./page.js";
import { homeState } from "./states/home.js";
import { homeCorporateState } from "./states/home-corporate.js";
import { homeSingleSourceState } from "./states/home-single-source.js";
import { homeNoScriptState } from "./states/home-no-script.js";
import { entityPageState } from "./states/entity-page.js";
import { entityPageCorporateState } from "./states/entity-page-corporate.js";
import { entityPageEmptyState } from "./states/entity-page-empty.js";
import { entityPageDocumentState } from "./states/entity-page-document.js";
import { entityPageNoPropertyState } from "./states/entity-page-no-property.js";
import { entityPageNoScriptState } from "./states/entity-page-no-script.js";
import { searchResultsState } from "./states/search-results.js";
import { searchResultsEmptyState } from "./states/search-results-empty.js";
import { searchResultsCorporateState } from "./states/search-results-corporate.js";
import { searchResultsNoScriptState } from "./states/search-results-no-script.js";
import { keywordPageState } from "./states/keyword-page.js";
import { keywordPageEmptyState } from "./states/keyword-page-empty.js";
import { keywordPageCorporateState } from "./states/keyword-page-corporate.js";
import { keywordPageNoTimecodeState } from "./states/keyword-page-no-timecode.js";
import { keywordPageNoScriptState } from "./states/keyword-page-no-script.js";
import { meetingPageCorporateState } from "./states/meeting-page-corporate.js";
import { meetingPageNoScriptState } from "./states/meeting-page-no-script.js";
import { entityPageContractState } from "./states/entity-page-contract.js";
import { apiPageCorporateState } from "./states/api-page-corporate.js";
import { apiPageNoContractState } from "./states/api-page-no-contract.js";
import { apiPageNoScriptState } from "./states/api-page-no-script.js";
import { entityPageMapState } from "./states/entity-page-map.js";
import { entityPagePhoneState } from "./states/entity-page-phone.js";
import { entityPageDrawerState } from "./states/entity-page-drawer.js";
import { entityPageTabletState } from "./states/entity-page-tablet.js";
import { indexPageState } from "./states/index-page.js";
import { indexCorporateState } from "./states/index-corporate.js";
import { spacesCorporateState } from "./states/spaces-corporate.js";
import { spaceCorporateState } from "./states/space-corporate.js";
import { categoryCorporateState } from "./states/category-corporate.js";
import { screenPageCorporateState } from "./states/screen-page-corporate.js";
import { documentPageCorporateState } from "./states/document-page-corporate.js";
import { documentPageNoScriptState } from "./states/document-page-no-script.js";
import { decisionPageCorporateState } from "./states/decision-page-corporate.js";
import { todoState } from "./states/todo.js";
import { todoEmptyState } from "./states/todo-empty.js";
import { todoCorporateState } from "./states/todo-corporate.js";
import { mentionsPanelState } from "./states/mentions-panel.js";
import { mentionsPanelEmptyState } from "./states/mentions-panel-empty.js";
import { mentionsPanelIslandState } from "./states/mentions-panel-island.js";
import { neighbourhoodState } from "./states/neighbourhood.js";
import { neighbourhoodFullState } from "./states/neighbourhood-full.js";
import { neighbourhoodOverflowState } from "./states/neighbourhood-overflow.js";
import { neighbourhoodEmptyState } from "./states/neighbourhood-empty.js";
import { shellRtlState } from "./states/shell-rtl.js";
import { headerLogoState } from "./states/header-logo.js";
import { footerTextState } from "./states/footer-text.js";
import { entityPageDarkState } from "./states/entity-page-dark.js";
import { homeDarkState } from "./states/home-dark.js";
import { footerCorporateState } from "./states/footer-corporate.js";
import { footerAloneState } from "./states/footer-alone.js";

export type { GalleryPage, GalleryWidth } from "./page.js";
export { DEFAULT_GALLERY_WIDTH, GALLERY_WIDTHS } from "./page.js";

/** Every page of the gallery, one state file each, in the order of the boards then of the states. */
export const galleryPages: readonly GalleryPage[] = [
  homeState,
  homeCorporateState,
  homeSingleSourceState,
  homeNoScriptState,
  entityPageState,
  entityPageCorporateState,
  entityPageEmptyState,
  entityPageDocumentState,
  entityPageNoPropertyState,
  entityPageNoScriptState,
  searchResultsState,
  searchResultsEmptyState,
  searchResultsCorporateState,
  searchResultsNoScriptState,
  keywordPageState,
  keywordPageEmptyState,
  keywordPageCorporateState,
  keywordPageNoTimecodeState,
  keywordPageNoScriptState,
  meetingPageCorporateState,
  meetingPageNoScriptState,
  entityPageContractState,
  apiPageCorporateState,
  apiPageNoContractState,
  apiPageNoScriptState,
  entityPageMapState,
  entityPagePhoneState,
  entityPageDrawerState,
  entityPageTabletState,
  indexPageState,
  indexCorporateState,
  spacesCorporateState,
  spaceCorporateState,
  categoryCorporateState,
  screenPageCorporateState,
  documentPageCorporateState,
  documentPageNoScriptState,
  decisionPageCorporateState,
  footerCorporateState,
  footerAloneState,
  entityPageDarkState,
  homeDarkState,
  todoState,
  todoEmptyState,
  todoCorporateState,
  mentionsPanelState,
  mentionsPanelEmptyState,
  mentionsPanelIslandState,
  neighbourhoodState,
  neighbourhoodFullState,
  neighbourhoodOverflowState,
  neighbourhoodEmptyState,
  shellRtlState,
  headerLogoState,
  footerTextState,
];
