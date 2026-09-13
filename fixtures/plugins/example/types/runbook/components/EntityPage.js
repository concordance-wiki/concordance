import { h } from "preact";

/**
 * The page of a runbook: the trigger and the owner as a lead, the steps as a numbered checklist
 * under the title, then the note as the generic page would render it. Only the header differs.
 */
export default function RunbookPage({ entity, highlights, sections, otherAttributes = [] }) {
  const lead = highlights.map((attribute) =>
    h(
      "span",
      { class: "runbook-lead", key: attribute.name },
      `${attribute.label}: ${attribute.values.map((value) => value.text).join(", ")}`,
    ),
  );
  return h(
    "div",
    { class: "entity runbook" },
    h(
      "header",
      { class: "entity-header" },
      h("p", { class: "entity-badge" }, h("span", { class: "badge" }, entity.typeLabel), ...lead),
      h("h1", null, entity.title),
    ),
    h(
      "article",
      { class: "entity-body" },
      ...sections.map((section) =>
        h(
          "section",
          { id: section.id, key: section.id, class: section.key === "steps" ? "runbook-steps" : "" },
          section.heading === undefined ? null : h("h2", null, section.heading),
          h("div", { class: "markdown", dangerouslySetInnerHTML: { __html: section.html } }),
        ),
      ),
    ),
    otherAttributes.length === 0
      ? null
      : h(
          "aside",
          { class: "entity-panel", "aria-labelledby": "runbook-other" },
          h("h2", { id: "runbook-other" }, "Other attributes"),
          h(
            "dl",
            { class: "attributes" },
            ...otherAttributes.map((attribute) =>
              h(
                "div",
                { class: "attribute", key: attribute.name },
                h("dt", null, attribute.label),
                ...attribute.values.map((value, index) => h("dd", { key: index }, value.text)),
              ),
            ),
          ),
        ),
  );
}
