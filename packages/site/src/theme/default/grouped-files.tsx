import type { JSX } from "preact";

import type { GroupedFiles } from "../../slots.js";

/**
 * The files the build merged into the page, at the foot of the properties block of every
 * template: the line counting them and naming what grouped them, "3 files grouped — same base
 * name", each file with its kind, then the way to contest the grouping, a link that always
 * leads somewhere, to the contribution address of the project or to the guide of the lock file.
 */
export function GroupedFilesBlock({ grouping }: { grouping: GroupedFiles }): JSX.Element {
  return (
    <div class="grouped-files">
      <p class="grouped-files-lead">{grouping.label}</p>
      <ul class="grouped-files-list">
        {grouping.files.map((file) => (
          <li key={file.name}>
            <code class="grouped-file-name">{file.name}</code>
            <span class="grouped-file-format">{file.format}</span>
          </li>
        ))}
      </ul>
      <a class="grouped-files-separate" href={grouping.separate.href}>
        {grouping.separate.label}
      </a>
    </div>
  );
}
