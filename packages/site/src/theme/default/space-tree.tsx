import type { JSX } from "preact";

import type { SpaceNode, SpaceTree as SpaceTreeModel } from "../../slots.js";

/** A page of the tree links to itself; the current one is a plain entry marked `aria-current`, bold and ruled by the stylesheet. */
function Page({ node }: { node: SpaceNode }): JSX.Element {
  return node.current === true ? (
    <li class="space-page space-current">
      <span aria-current="page">{node.label}</span>
    </li>
  ) : (
    <li class="space-page">
      <a href={node.href}>{node.label}</a>
    </li>
  );
}

/** A folder shows its name and its page count; the folders on the way to the current page list their contents under them. */
function Folder({ node }: { node: SpaceNode }): JSX.Element {
  return (
    <li class={node.children === undefined ? "space-folder" : "space-folder space-open"}>
      <span class="space-folder-name">
        {node.label}
        {node.count !== undefined && <span class="count">{node.count}</span>}
      </span>
      {node.children !== undefined && <Nodes nodes={node.children} />}
    </li>
  );
}

function Node({ node }: { node: SpaceNode }): JSX.Element {
  if (node.omitted === true) {
    return <li class="space-omitted">{node.label}</li>;
  }
  return node.href === undefined && node.current !== true ? (
    <Folder node={node} />
  ) : (
    <Page node={node} />
  );
}

/** The nodes of a tree at one level; the home page draws the whole tree of every space with it. */
export function Nodes({ nodes }: { nodes: readonly SpaceNode[] }): JSX.Element {
  return (
    <ul class="space-nodes">
      {nodes.map((node, index) => (
        <Node key={index} node={node} />
      ))}
    </ul>
  );
}

/**
 * The left column: the initials badge and the name of the space, then its tree, folded behind
 * that name where the layout has no column for it. The badge is decorative: the name follows it.
 */
export function SpaceTree({ space, label }: { space: SpaceTreeModel; label: string }): JSX.Element {
  return (
    <nav class="space" aria-label={label}>
      <details class="space-tree">
        <summary class="space-head">
          <span class="space-initials" aria-hidden="true">
            {space.initials}
          </span>
          <span class="space-name">{space.name}</span>
        </summary>
        <Nodes nodes={space.nodes} />
      </details>
    </nav>
  );
}
