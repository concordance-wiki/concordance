import { Component, type JSX } from "preact";

import type {
  CategoryChoice,
  CategoryFilter,
  CategoryListLabels,
  CategoryPage,
  CategoryRow,
  CategorySort,
} from "../../slots.js";
import { fill } from "./mention-list.js";

export const CATEGORY_ISLAND = "category-list";

/** How many rows a page of the list holds: "pagination by twenty", as the note under the list says. */
export const CATEGORY_PAGE_SIZE = 20;

/** The rows the island holds in the order of a sort: by title as received, or by number of related pages, most first, the title order breaking ties. */
export function orderRows(rows: readonly CategoryRow[], sort: CategorySort): CategoryRow[] {
  if (sort === "title") return [...rows];
  // A stable sort over the title order: two rows with the same count keep their order.
  return [...rows].sort((a, b) => b.links - a.links);
}

/** The rows carrying a key of the attribute filter; every row when the filter is lifted. */
export function filterRows(rows: readonly CategoryRow[], key: string | undefined): CategoryRow[] {
  return key === undefined ? [...rows] : rows.filter((row) => row.keys.includes(key));
}

/** How many pages of twenty a list of that many rows takes: one at least, so that an empty list still has its page. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
}

/** The rows of one page of the list, the first page for a number out of range. */
export function pageRows(rows: readonly CategoryRow[], page: number): CategoryRow[] {
  const at = page >= 1 && page <= pageCount(rows.length) ? page : 1;
  return rows.slice((at - 1) * CATEGORY_PAGE_SIZE, at * CATEGORY_PAGE_SIZE);
}

/** The two entries of the sort selector, the current one active, each with its address when the variants are pre-rendered. */
export function sortChoices(
  labels: CategoryListLabels,
  sort: CategorySort,
  hrefs: Partial<Record<CategorySort, string>> = {},
): CategoryChoice[] {
  return (["title", "links"] as const).map((key) => ({
    label: key === "title" ? labels.sortTitle : labels.sortLinks,
    key,
    ...(hrefs[key] === undefined ? {} : { href: hrefs[key] }),
    active: key === sort,
  }));
}

/** What the table and its selectors show: one page of rows, the choices of the selectors, and what a choice does once the island runs. */
export interface CategoryView {
  /** Heading of the first column: the label of the type, or "Page". */
  unit: string;
  filter?: CategoryFilter;
  sort: CategorySort;
  sorts: CategoryChoice[];
  /** The rows of the page shown. */
  rows: CategoryRow[];
  /** How many rows the whole list holds under the current filter. */
  total: number;
  page: number;
  pages: CategoryPage[];
  labels: CategoryListLabels;
  /** Whether the selectors are drawn: never before the island runs when the choices have no address. */
  controls: boolean;
  onSort?: (sort: CategorySort) => void;
  onFilter?: (key: string | undefined) => void;
  onPage?: (page: number) => void;
}

/** One entry of a selector: a link to its variant, the current one marked, or a button once the island applies the choice in place. */
function Choice({
  choice,
  onChoose,
}: {
  choice: CategoryChoice;
  onChoose?: () => void;
}): JSX.Element {
  if (onChoose !== undefined) {
    return (
      <button type="button" aria-pressed={choice.active} onClick={onChoose}>
        {choice.label}
      </button>
    );
  }
  return choice.active ? (
    <span aria-current="true">{choice.label}</span>
  ) : choice.href === undefined ? (
    <span>{choice.label}</span>
  ) : (
    <a href={choice.href}>{choice.label}</a>
  );
}

/**
 * A selector: a disclosure whose summary reads what is selected with a ▾ mark, the name of the
 * selector before it for assistive technology when the summary does not say it, and whose list
 * holds the choices.
 */
function Selector({
  className,
  name,
  label,
  choices,
  onChoose,
}: {
  className: string;
  name?: string;
  label: string;
  choices: CategoryChoice[];
  onChoose?: (choice: CategoryChoice) => void;
}): JSX.Element {
  return (
    <details class={`category-select ${className}`}>
      <summary>
        {name !== undefined && <span class="visually-hidden">{name}: </span>}
        {label}
        <span class="category-select-mark" aria-hidden="true">
          ▾
        </span>
      </summary>
      <ul class="category-choices">
        {choices.map((choice, index) => (
          <li key={index}>
            <Choice
              choice={choice}
              {...(onChoose === undefined
                ? {}
                : {
                    onChoose: () => {
                      onChoose(choice);
                    },
                  })}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Row({ row }: { row: CategoryRow }): JSX.Element {
  return (
    <tr>
      <th scope="row" class="category-title">
        <a href={row.href}>{row.title}</a>
      </th>
      <td class="category-value">
        {row.values.map((value, index) => (
          <span key={index}>
            {index > 0 && ", "}
            {value.href === undefined ? value.text : <a href={value.href}>{value.text}</a>}
          </span>
        ))}
      </td>
      <td class="category-summary">{row.summary}</td>
      <td class="category-links">{row.links}</td>
    </tr>
  );
}

/** The page links under the list, the current page marked; nothing for a list of one page. */
function Pages({ view }: { view: CategoryView }): JSX.Element | null {
  const { pages, page, labels, onPage } = view;
  if (pages.length <= 1) return null;
  return (
    <nav class="category-pages" aria-label={labels.pagination}>
      <ol>
        {pages.map((entry) => (
          <li key={entry.number}>
            {onPage !== undefined && entry.number !== page ? (
              <button
                type="button"
                onClick={() => {
                  onPage(entry.number);
                }}
              >
                {entry.number}
              </button>
            ) : entry.number === page ? (
              <span aria-current="page">{entry.number}</span>
            ) : (
              <a href={entry.href}>{entry.number}</a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The list itself: the selectors of the attribute and of the sort, the table with the title, the
 * highlighted attribute, the first line and the number of related pages of every row, then how
 * many rows the page shows of the whole, the page links and the note on the links column.
 */
export function CategoryBody({ view }: { view: CategoryView }): JSX.Element {
  const { filter, labels, onFilter, onSort } = view;
  // The value kept, read on the summary of the filter; the attribute name when every row is kept.
  const kept = filter?.choices.find((choice) => choice.active && choice.key !== undefined)?.label;
  return (
    <>
      {view.controls && (
        <div class="category-toolbar">
          {filter !== undefined && (
            <Selector
              className="category-filter"
              {...(kept === undefined ? {} : { name: filter.label })}
              label={kept ?? filter.label}
              choices={filter.choices}
              {...(onFilter === undefined
                ? {}
                : {
                    onChoose: (choice: CategoryChoice) => {
                      onFilter(choice.key);
                    },
                  })}
            />
          )}
          <Selector
            className="category-sort"
            name={labels.sort}
            label={view.sorts.find((choice) => choice.active)?.label ?? labels.sortTitle}
            choices={view.sorts}
            {...(onSort === undefined
              ? {}
              : {
                  onChoose: (choice: CategoryChoice) => {
                    onSort(choice.key === "links" ? "links" : "title");
                  },
                })}
          />
        </div>
      )}
      <div class="category-card">
        <table class="category-table">
          <thead>
            <tr>
              <th scope="col" class="category-title">
                {view.unit}
              </th>
              <th scope="col" class="category-value">
                {filter?.label}
              </th>
              <th scope="col" class="category-summary">
                {labels.firstLine}
              </th>
              <th scope="col" class="category-links">
                {labels.links}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <Row key={row.href} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <p class="category-foot">
        <span class="category-shown" role="status">
          {fill(labels.shownOf, { shown: view.rows.length, total: view.total })}
        </span>{" "}
        <span class="category-note">{labels.note}</span>
      </p>
      <Pages view={view} />
    </>
  );
}

/** What the island receives: every row of the list, the choices without addresses, and the page the served markup shows. */
export interface CategoryIslandProps {
  unit: string;
  filter?: CategoryFilter;
  sort: CategorySort;
  /** Every row of the list, in title order. */
  rows: CategoryRow[];
  page: number;
  /** The page links of the served state, followed until the island runs. */
  pages: CategoryPage[];
  labels: CategoryListLabels;
}

export interface CategoryIslandState {
  /** False in the served HTML and until the island mounts: the selectors exist only once it runs. */
  hydrated: boolean;
  sort: CategorySort;
  /** The key of the attribute value kept; every row when absent. */
  key?: string | undefined;
  page: number;
}

/**
 * The list whose sort and filter are applied in place: the served markup shows the page of the
 * received state without any selector; once mounted, the selectors appear and every choice
 * re-orders, filters or pages the rows the island holds, the page links becoming buttons.
 */
export class CategoryIsland extends Component<CategoryIslandProps, CategoryIslandState> {
  constructor(props: CategoryIslandProps) {
    super(props);
    this.state = { hydrated: false, sort: props.sort, page: props.page };
  }

  override componentDidMount(): void {
    this.setState({ hydrated: true });
  }

  changeSort = (sort: CategorySort): void => {
    this.setState({ sort, page: 1 });
  };

  changeFilter = (key: string | undefined): void => {
    // The state merges: the key is set to nothing rather than left out, so that the filter lifts.
    this.setState({ key, page: 1 });
  };

  changePage = (page: number): void => {
    this.setState({ page });
  };

  /** The choices of the filter, the one kept marked, the entry lifting it active when none is. */
  private filterOf(): CategoryFilter | undefined {
    const { filter } = this.props;
    if (filter === undefined) return undefined;
    return {
      label: filter.label,
      choices: filter.choices.map((choice) => ({
        label: choice.label,
        ...(choice.key === undefined ? {} : { key: choice.key }),
        active: choice.key === this.state.key,
      })),
    };
  }

  override render(): JSX.Element {
    const { props, state } = this;
    const kept = filterRows(orderRows(props.rows, state.sort), state.key);
    const pages = pageCount(kept.length);
    const page = state.page >= 1 && state.page <= pages ? state.page : 1;
    const filter = this.filterOf();
    const view: CategoryView = {
      unit: props.unit,
      ...(filter === undefined ? {} : { filter }),
      sort: state.sort,
      sorts: sortChoices(props.labels, state.sort),
      rows: pageRows(kept, page),
      total: kept.length,
      page,
      pages: state.hydrated
        ? Array.from({ length: pages }, (_, index) => ({ number: index + 1 }))
        : props.pages,
      labels: props.labels,
      controls: state.hydrated,
      ...(state.hydrated
        ? { onSort: this.changeSort, onFilter: this.changeFilter, onPage: this.changePage }
        : {}),
    };
    return <CategoryBody view={view} />;
  }
}
