import { chrome, type GalleryPage } from "../page.js";
import { corporateFooter, corporateHeader } from "../fixtures/chrome.js";
import { ageNoticeCorporate } from "../fixtures/edge-cases.js";
import { corporateHome } from "../fixtures/home.js";

export const ageNoticeState: GalleryPage = {
  file: "age-notice.html",
  slot: "Home",
  rendered: "Home",
  state: "age-notice",
  description:
    "the home page twelve days after a publication declared daily: between the bar and the page, the notice the island shows past three times the cadence, the age counted in the browser, the cadence as the configuration declares it, the two exits and the button that closes it until a later publication grows old in its turn; served hidden, since no page knows the day it is read without a script",
  board: "B17",
  ...chrome,
  header: corporateHeader,
  footer: corporateFooter,
  props: corporateHome,
  notice: ageNoticeCorporate,
};
