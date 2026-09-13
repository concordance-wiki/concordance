import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { corporateMeetingHeader, corporateMeetingPage } from "../fixtures/meeting-page.js";

export const meetingPageCorporateState: GalleryPage = {
  file: "meeting-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "meeting",
  description:
    "a working session of the fixtures corpus that exists as a note, a transcript and a deck, merged into one page: the tree of the meetings space by year and month, the breadcrumb naming the month, the line reading the type, the duration and that the participants are pseudonymised, the tabs of the three representations with the mention that they were grouped, the transcript as timestamped lines with the speakers and the note on the pseudonyms, the callout of the decision the meeting produced; in the panel the date, the duration, the space and the grouped files with why, the related pages with the note that a meeting does not enter the model, the neighbourhood folded",
  ...chrome,
  header: corporateMeetingHeader,
  footer: corporateFooter,
  props: corporateMeetingPage,
};
