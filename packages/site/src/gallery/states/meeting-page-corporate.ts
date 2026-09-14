import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter } from "../fixtures/chrome.js";
import { corporateMeetingHeader, corporateMeetingPage } from "../fixtures/meeting-page.js";

export const meetingPageCorporateState: GalleryPage = {
  file: "meeting-page-corporate.html",
  slot: "EntityPage",
  rendered: "EntityPage",
  state: "meeting",
  description:
    "a working session of the fixtures corpus that exists as a note, a transcript and a deck, merged into one page: the tree of the meetings space by year and month, the breadcrumb naming the month, the line reading the type, the duration and that the participants are pseudonymised, the tabs Transcript, Notes and Deck following the tablist pattern with the mention that the files were grouped, the transcript as timestamped lines with the speakers, the callout of the decision the meeting produced under the cue it came from, the note on the pseudonyms, the deck as one tab with its original, its viewer and its extracted text; in the panel the date, the duration, the space and the grouped files with why, the related pages with the note that a meeting does not enter the model, the neighbourhood folded",
  ...chrome,
  header: corporateMeetingHeader,
  footer: corporateFooter,
  props: corporateMeetingPage,
};
