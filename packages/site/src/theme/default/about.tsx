import type { JSX } from "preact";

import type { AboutLabels, AboutProps, AboutSource, Section } from "../../slots.js";
import { Breadcrumb } from "./entity-page.js";
import { labels } from "./labels.js";

/** The English strings of the page, kept out of `labels.ts` so that the island bundles, which take that module whole, do not carry them. */
const english = {
  home: "Home",
  title: "About this wiki",
  lead: "This site is rebuilt at every change of the repositories. It is not edited here: every correction is made in the original file, and appears at the next publication.",
  publishedOn: "Published on",
  words: "Indexed words",
  sources: "Sources",
  sourcesLead: "each with the version exactly used",
  repository: "Repository",
  nature: "Nature",
  version: "Version",
  content: "Content kept",
  lastChange: "Last change",
  versionsNote:
    "The versions are those read at publication: two publications on the same versions produce an identical site.",
  staleSource: "The source",
  staleExceeds:
    "exceeds the freshness threshold of {count} days, which is reported here and in the build report, never on the pages themselves.",
  notContained: "What the site does not contain.",
  notContainedText:
    "The files the configuration excludes, the documents whose conversion failed, and the words used fewer than {count} times. The",
  report: "publication report",
  reportLists: "lists them.",
  correct: "Correct a page.",
  correctText:
    "Every page carries at its foot the path of its file and a link to the forge. There is no other way to edit, and that is deliberate.",
  contribute: "How to contribute",
  pseudonymised: "What is pseudonymised.",
} as const;

/** The labels of the default theme for every label the page does not receive, the threshold worded from the page. */
export function defaultAboutLabels(threshold: number): AboutLabels {
  return {
    home: english.home,
    breadcrumb: labels.breadcrumb,
    title: english.title,
    lead: english.lead,
    publishedOn: english.publishedOn,
    pages: labels.pages,
    words: english.words,
    sources: english.sources,
    sourcesLead: english.sourcesLead,
    repository: english.repository,
    nature: english.nature,
    version: english.version,
    content: english.content,
    lastChange: english.lastChange,
    versionsNote: english.versionsNote,
    staleSource: english.staleSource,
    stale: labels.staleSpace,
    notContained: english.notContained,
    notContainedText: english.notContainedText.replace("{count}", String(threshold)),
    report: english.report,
    reportLists: english.reportLists,
    correct: english.correct,
    correctText: english.correctText,
    contribute: english.contribute,
    pseudonymised: english.pseudonymised,
    pseudonymisedText: labels.pseudonymNote,
  };
}

/**
 * The row of a source: the repository, what it holds, the commit the build read, how much the
 * site kept and its newest change; past the freshness threshold the date reads in the accent
 * and in days, and a hidden phrase says so to assistive technology, which sees no colour.
 */
function Row({ source, stale }: { source: AboutSource; stale: string }): JSX.Element {
  return (
    <tr class={source.stale ? "about-row stale" : "about-row"}>
      <th scope="row" class="about-repository">
        {source.name}
      </th>
      <td class="about-nature">{source.nature}</td>
      <td class="about-version">{source.version ?? ""}</td>
      <td class="about-content">{source.content}</td>
      <td class="about-date">
        {source.date !== undefined && (
          <time dateTime={source.date}>{source.dateLabel ?? source.date}</time>
        )}
        {source.stale && <span class="visually-hidden">, {stale}</span>}
      </td>
    </tr>
  );
}

/** The sentence naming a dormant source under the table, its threshold worded by the site or by the theme. */
function StaleNote({
  source,
  threshold,
  text,
}: {
  source: AboutSource;
  threshold: number;
  text: AboutLabels;
}): JSX.Element {
  return (
    <>
      {" "}
      {text.staleSource} <b>{source.name}</b>{" "}
      {source.staleNote ?? english.staleExceeds.replace("{count}", String(threshold))}
    </>
  );
}

/** A section of the file the configuration names, as the build rendered it. */
function ExtraSection({ section }: { section: Section }): JSX.Element {
  return (
    <section id={section.id}>
      {section.heading !== undefined && <h2>{section.heading}</h2>}
      <div class="markdown" dangerouslySetInnerHTML={{ __html: section.html }} />
    </section>
  );
}

/**
 * The about page, the page of trust: the breadcrumb from the home page, the title, the
 * sentence saying the site is rebuilt and not edited here, the figures of the build, the
 * sources with the version each was read at, what the site leaves out and how a page is
 * corrected; then the sections of the file the configuration names, when it names one.
 */
export function About({
  homeHref,
  figures,
  sources,
  threshold,
  reportHref,
  contributeHref,
  pseudonymised,
  sections = [],
  labels: given = {},
}: AboutProps): JSX.Element {
  const text: AboutLabels = { ...defaultAboutLabels(threshold), ...given };
  const dormant = sources.flatMap((source) =>
    source.threshold === undefined ? [] : [{ source, threshold: source.threshold }],
  );
  return (
    <div class="about">
      <Breadcrumb
        items={[{ label: text.home, href: homeHref }, { label: text.title }]}
        label={text.breadcrumb}
      />
      <h1>{text.title}</h1>
      <p class="about-lead">{text.lead}</p>
      <dl class="about-figures">
        {figures.map((figure) => (
          <div key={figure.label} class="about-figure">
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
      <section class="about-sources" aria-labelledby="about-sources">
        <h2 id="about-sources">
          {text.sources} <span class="about-sources-lead">{text.sourcesLead}</span>
        </h2>
        <table class="about-table">
          <thead>
            <tr>
              <th scope="col" class="about-repository">
                {text.repository}
              </th>
              <th scope="col" class="about-nature">
                {text.nature}
              </th>
              <th scope="col" class="about-version">
                {text.version}
              </th>
              <th scope="col" class="about-content">
                {text.content}
              </th>
              <th scope="col" class="about-date">
                {text.lastChange}
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <Row key={source.name} source={source} stale={text.stale} />
            ))}
          </tbody>
        </table>
        <p class="about-note">
          {text.versionsNote}
          {dormant.map(({ source, threshold: days }) => (
            <StaleNote key={source.name} source={source} threshold={days} text={text} />
          ))}
        </p>
      </section>
      <div class="about-closing">
        <p>
          <b>{text.notContained}</b> {text.notContainedText} <a href={reportHref}>{text.report}</a>{" "}
          {text.reportLists}
        </p>
        <p>
          <b>{text.correct}</b> {text.correctText}
          {contributeHref !== undefined && (
            <>
              {" "}
              <a href={contributeHref}>{text.contribute}</a>
            </>
          )}
        </p>
        {pseudonymised && (
          <p>
            <b>{text.pseudonymised}</b> {text.pseudonymisedText}
          </p>
        )}
      </div>
      {sections.map((section) => (
        <ExtraSection key={section.id} section={section} />
      ))}
    </div>
  );
}
