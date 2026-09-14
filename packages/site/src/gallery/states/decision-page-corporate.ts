import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { corporateDecisionHeader, corporateDecisionPage } from "../fixtures/decision-page.js";

export const decisionPageCorporateState: GalleryPage = {
  file: "decision-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "decision",
  description:
    "a decision of the fixtures corpus that replaces an earlier one and was taken in a working session: the tree of the decisions space by year, the breadcrumb naming the year, one chip reading the type and the status, the identifier and the day of the decision on the line under the title, the note in its three sections, the callout naming the session and the timecode of the cue that names the decision, the path of the file; in the panel the status and the date first, then the decision it supersedes and its session, the note counting the keys, the related pages with the note that a decision cites what it changes, the neighbourhood folded",
  board: "B16",
  ...chrome,
  header: corporateDecisionHeader,
  footer: corporateFooter,
  props: corporateDecisionPage,
};
