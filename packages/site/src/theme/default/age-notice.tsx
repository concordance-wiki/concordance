import type { JSX } from "preact";

import { AGE_ISLAND } from "../../islands/age.js";
import { island } from "../../islands/island.js";
import { plural, type PluralForms } from "../../search/shared.js";

export interface AgeNoticeLabels {
  /** The chip at the head of the notice: "Notice". */
  notice: string;
  /** "This version was published N days ago.", by plural category, `#` standing for the days. */
  published: PluralForms;
  /** "Publications are declared daily in the configuration.", the cadence already worded. */
  cadence: string;
  /** "A recent change of the repositories may therefore be missing here." */
  missing: string;
  /** The first exit: "See the sources and their versions". */
  sources: string;
  /** The word between the two exits. */
  or: string;
  /** The second exit: "consult the repositories directly". */
  repositories: string;
  /** Accessible name of the button closing the notice. */
  close: string;
}

export interface AgeNoticeProps {
  /** ISO 8601 instant of the publication, what the island compares with the day the page is read. */
  publishedAt: string;
  /** Days between two publications; the notice shows past `AGE_THRESHOLD` times that many. */
  everyDays: number;
  /** BCP 47 tag of the page, which words the count of days. */
  locale: string;
  /** Href of the list of the spaces from the page. */
  sourcesHref: string;
  /** Href of the repository of a source; the second exit is not drawn without one. */
  repositoryHref?: string;
  labels: AgeNoticeLabels;
  /** The age in days once the island counted it; the served notice, hidden, carries none. */
  days?: number;
}

/**
 * The notice on the age of the site, the only fact a static site can tell about its freshness:
 * its publication date is written in it, the expected cadence is declared in the configuration,
 * and past three times that cadence the notice appears by itself, without a server or a
 * request. It closes, and comes back only after a later publication grows old in its turn. A
 * failed publication deploys nothing and writes nothing: that is for the pipeline to report.
 * Served hidden: without a script no page knows the day it is read.
 */
function AgeNoticeBody(props: AgeNoticeProps): JSX.Element {
  const { labels, days } = props;
  return (
    <aside class="age-notice" aria-label={labels.notice} hidden={days === undefined}>
      <span class="age-notice-chip">{labels.notice}</span>
      <div class="age-notice-text">
        <p class="age-notice-lead">
          {days === undefined ? "" : plural(labels.published, days, props.locale)}
        </p>
        <p class="age-notice-detail">
          {labels.cadence} {labels.missing} <a href={props.sourcesHref}>{labels.sources}</a>
          {props.repositoryHref !== undefined && (
            <>
              {" "}
              {labels.or} <a href={props.repositoryHref}>{labels.repositories}</a>
            </>
          )}
          .
        </p>
      </div>
      <button type="button" class="age-notice-close">
        <span aria-hidden="true">✕</span>
        <span class="visually-hidden">{labels.close}</span>
      </button>
    </aside>
  );
}

export const AgeNotice = island(AGE_ISLAND, AgeNoticeBody);
