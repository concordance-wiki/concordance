import { chrome, type GalleryPage } from "../page.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";
import { corporateScreenPage } from "../fixtures/screen-page.js";

export const screenPageCorporateState: GalleryPage = {
  file: "screen-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "screen-corporate",
  description:
    "a screen of the fixtures corpus in the corporate chrome, the most consulted type: the screens folder open on its neighbours, the breadcrumb, the line under the title, the note section by section with a table of the checks it applies and the original sketch of the screen shown in the flow with its caption, its note and its path; the legend and the path at the foot of the article; in the panel the properties with the count of declared keys, the sections, the related pages written links first, the neighbourhood folded",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateScreenPage,
};
