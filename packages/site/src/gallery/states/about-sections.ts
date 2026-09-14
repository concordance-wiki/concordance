import { chrome, type GalleryPage } from "../page.js";
import { aboutWithSections } from "../fixtures/about.js";
import { corporateHeader, corporateFooter } from "../fixtures/chrome.js";

export const aboutSectionsState: GalleryPage = {
  file: "about-sections.html",
  slot: "About",
  rendered: "About",
  state: "sections",
  description:
    "the about page extended by the markdown file the configuration names: its sections follow the generated content, on the same template",
  board: "B19",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: aboutWithSections,
};
