import type { JSX } from "preact";

import type { SpaceNode, SpaceTree as SpaceTreeModel } from "../../slots.js";

/** A page of the tree links to itself; the current one is a plain entry marked `aria-current`, bold and ruled by the stylesheet, its passage count after its name when it is a word filed among the notes, the pages hung under it listed after it. */
function Page({ node }: { node: SpaceNode }): JSX.Element {
  return node.current === true ? (
    <li class="space-page space-current">
      <span aria-current="page">
        {node.label}
        {node.passages !== undefined && <span class="count">{node.passages}</span>}
      </span>
      {node.children !== undefined && <Nodes nodes={node.children} />}
    </li>
  ) : (
    <li class="space-page">
      <a href={node.href}>{node.label}</a>
    </li>
  );
}

/**
 * A folder shows its name and its page count; the folders on the way to the current page list
 * their contents under them. A folder at the top of the space links to its list; the folder
 * whose list is the current page is marked as the current page is.
 */
function Folder({ node }: { node: SpaceNode }): JSX.Element {
  const classes = [
    "space-folder",
    ...(node.children === undefined ? [] : ["space-open"]),
    ...(node.current === true ? ["space-current"] : []),
  ];
  const name = (
    <>
      {node.label}
      <span class="count">{node.count}</span>
    </>
  );
  return (
    <li class={classes.join(" ")}>
      {node.current === true ? (
        <span class="space-folder-name" aria-current="page">
          {name}
        </span>
      ) : node.href === undefined ? (
        <span class="space-folder-name">{name}</span>
      ) : (
        <a class="space-folder-name" href={node.href}>
          {name}
        </a>
      )}
      {node.children !== undefined && <Nodes nodes={node.children} />}
    </li>
  );
}

/** A node with a count is a folder; the others are pages, the current one included. */
function Node({ node }: { node: SpaceNode }): JSX.Element {
  if (node.omitted === true) {
    return <li class="space-omitted">{node.label}</li>;
  }
  return node.count === undefined ? <Page node={node} /> : <Folder node={node} />;
}

/** The nodes of a tree at one level; the home page draws the whole tree of every space with it. */
export function Nodes({ nodes }: { nodes: readonly SpaceNode[] }): JSX.Element {
  return (
    <ul class="space-nodes">
      {nodes.map((node) => (
        <Node key={node.href ?? node.label} node={node} />
      ))}
    </ul>
  );
}

/** The badge and the name of the space, as the head of its tree shows them. */
function SpaceHead({ space }: { space: SpaceTreeModel }): JSX.Element {
  return (
    <>
      <span class="space-initials" aria-hidden="true">
        {space.initials}
      </span>
      <span class="space-name">{space.name}</span>
    </>
  );
}

/** The badge and the name of the space heading its tree, a disclosure: served open in the drawer, closed elsewhere. */
export function SpaceTreeFold({
  space,
  open = false,
}: {
  space: SpaceTreeModel;
  open?: boolean;
}): JSX.Element {
  return (
    <details class="space-tree" open={open}>
      <summary class="space-head">
        <SpaceHead space={space} />
      </summary>
      <Nodes nodes={space.nodes} />
    </details>
  );
}

/**
 * The left column: the initials badge and the name of the space as the link to its page, then
 * its tree, which the stylesheet keeps in view there, the summary of the disclosure hidden;
 * without a page to link, the disclosure heads the column. The badge is decorative: the name
 * follows it.
 */
export function SpaceTree({ space, label }: { space: SpaceTreeModel; label: string }): JSX.Element {
  return (
    <nav class="space" aria-label={label}>
      {space.href !== undefined && (
        <a class="space-head space-head-link" href={space.href}>
          <SpaceHead space={space} />
        </a>
      )}
      <SpaceTreeFold space={space} />
    </nav>
  );
}
