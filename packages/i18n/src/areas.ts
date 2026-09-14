import { apiMessages } from "./areas/api.js";
import { categoryMessages } from "./areas/category.js";
import { decisionMessages } from "./areas/decision.js";
import { documentMessages } from "./areas/document.js";
import { drawerMessages } from "./areas/drawer.js";
import { entityMessages } from "./areas/entity.js";
import { footerMessages } from "./areas/footer.js";
import { homeMessages } from "./areas/home.js";
import { indexMessages } from "./areas/index.js";
import { keywordMessages } from "./areas/keyword.js";
import { meetingMessages } from "./areas/meeting.js";
import { mentionsMessages } from "./areas/mentions.js";
import { navMessages } from "./areas/nav.js";
import { neighbourhoodMessages } from "./areas/neighbourhood.js";
import { relatedMessages } from "./areas/related.js";
import { resultsMessages } from "./areas/results.js";
import { searchMessages } from "./areas/search.js";
import { siteMessages } from "./areas/site.js";
import { spaceMessages } from "./areas/space.js";
import { spacesMessages } from "./areas/spaces.js";
import { timeMessages } from "./areas/time.js";
import { todoMessages } from "./areas/todo.js";
import { trailMessages } from "./areas/trail.js";
import { transcriptMessages } from "./areas/transcript.js";

/** Every area of the catalogues, one per identifier prefix, in the order of the prefixes. */
export const AREAS = [
  apiMessages,
  categoryMessages,
  decisionMessages,
  documentMessages,
  drawerMessages,
  entityMessages,
  footerMessages,
  homeMessages,
  indexMessages,
  keywordMessages,
  meetingMessages,
  mentionsMessages,
  navMessages,
  neighbourhoodMessages,
  relatedMessages,
  resultsMessages,
  searchMessages,
  siteMessages,
  spaceMessages,
  spacesMessages,
  timeMessages,
  todoMessages,
  trailMessages,
  transcriptMessages,
] as const;
