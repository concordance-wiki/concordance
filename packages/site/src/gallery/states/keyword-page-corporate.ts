import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateKeywordPage } from "../fixtures/keyword-page.js";

export const keywordPageCorporateState: GalleryPage = {
  file: "keyword-page-corporate.html",
  slot: "KeywordPage",
  rendered: "KeywordPage",
  state: "corporate",
  description:
    "an expression of the fixtures corpus nobody defined, in the corporate chrome: the tree of the glossary with the word at its place, the breadcrumb, the dotted title, the line saying there is no definition and since when the word is used, the notice with the lead to propose a definition, the passages by file with their type, their title, their count and where each one stands, a timecode, a page or a line; in the panel what we know, the expressions that may be the same thing, the accompanying words, the related pages with the note that none is cited, the neighbourhood folded",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateKeywordPage,
};
