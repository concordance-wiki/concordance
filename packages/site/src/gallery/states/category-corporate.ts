import { chrome, type GalleryPage } from "../page.js";
import { corporateCategoryHeader, corporateCategoryList } from "../fixtures/category-list.js";
import { corporateFooter } from "../fixtures/chrome.js";

export const categoryCorporateState: GalleryPage = {
  file: "category-corporate.html",
  slot: "CategoryList",
  rendered: "CategoryList",
  state: "corporate",
  description:
    "the screens folder of the specifications space of the fixtures corpus in the corporate chrome: the field asking to search in the screens, the tree of the space with its folders and their counts, this one marked; the breadcrumb, the title, the count of screens with the description of the type, the role and sort selectors linking to their variants, the table of screens with the role, the first line and the number of related pages of each, the count of rows shown and the note on the links column",
  board: "B13",
  ...chrome,
  header: corporateCategoryHeader,
  footer: corporateFooter,
  props: corporateCategoryList,
};
