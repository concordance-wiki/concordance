import type { JSX } from "preact";

/**
 * A block of the right panel: a disclosure whose summary is the heading, served closed and
 * unfolded by the stylesheet where the layout has room for the panel.
 */
export function PanelBlock({
  id,
  className,
  heading,
  count,
  children,
}: {
  id: string;
  className: string;
  heading: string;
  /** How many entries the block holds, shown after the heading where the block is folded. */
  count?: number;
  children: JSX.Element | (JSX.Element | false)[];
}): JSX.Element {
  return (
    <section class={`panel-block ${className}`} aria-labelledby={id}>
      <details class="panel-fold">
        <summary>
          <h2 id={id}>
            {heading}
            {count !== undefined && <span class="count panel-count">{count}</span>}
          </h2>
        </summary>
        {children}
      </details>
    </section>
  );
}
