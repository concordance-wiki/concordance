import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { CategoryListLabels, CategoryListProps } from "../../slots.js";
import {
  CATEGORY_ISLAND,
  CategoryBody,
  CategoryIsland,
  type CategoryView,
} from "./category-island.js";
import { Breadcrumb } from "./entity-page.js";
import { labels } from "./labels.js";
import { SpaceTree } from "./space-tree.js";

// Created here rather than next to the component, so that the hydration entry bundles no server-side helper.
const CategoryListIsland = island(CATEGORY_ISLAND, CategoryIsland);

/** The labels of the default theme, used for every label the page does not receive. */
export const defaultCategoryListLabels: CategoryListLabels = {
  spaceTree: labels.spaceTree,
  breadcrumb: labels.breadcrumb,
  sort: labels.sort,
  sortTitle: labels.sortTitle,
  sortLinks: labels.sortLinks,
  all: labels.all,
  firstLine: labels.firstLine,
  links: labels.linksColumn,
  pagination: labels.pagesOfList,
  shownOf: labels.shownOf,
  note: labels.linksNote,
};

/**
 * The list of a category, the folder at the top of a space: the tree of the space on the left,
 * this folder marked; in the centre the breadcrumb, the title, the line counting the pages and
 * describing the type, the selectors of the highlighted attribute and of the sort, the table of
 * pages, how many the page shows of the whole, the page links and the note on the links column.
 * The selectors link to pre-rendered variants, or apply their choice in place through the island
 * when the variants would be too many; the table reads without any script either way.
 */
export function CategoryList({
  title,
  space,
  breadcrumb,
  lead,
  unit,
  filter,
  sort,
  sorts,
  rows,
  page,
  pages,
  total,
  island: inPlace = false,
  labels: given = {},
}: CategoryListProps): JSX.Element {
  const text: CategoryListLabels = { ...defaultCategoryListLabels, ...given };
  const view: CategoryView = {
    unit,
    ...(filter === undefined ? {} : { filter }),
    sort,
    sorts,
    rows,
    total: total ?? rows.length,
    page,
    pages,
    labels: text,
    controls: true,
  };
  return (
    <div class="category">
      <SpaceTree space={space} label={text.spaceTree} />
      <div class="category-main">
        <Breadcrumb items={breadcrumb} label={text.breadcrumb} />
        <header class="category-header">
          <h1>{title}</h1>
          <p class="category-lead">{lead}</p>
        </header>
        {inPlace ? (
          <CategoryListIsland
            unit={unit}
            {...(filter === undefined ? {} : { filter })}
            sort={sort}
            rows={rows}
            page={page}
            pages={pages}
            labels={text}
          />
        ) : (
          <CategoryBody view={view} />
        )}
      </div>
    </div>
  );
}
