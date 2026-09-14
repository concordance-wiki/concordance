/** The key of a keyboard event and what it takes to decide whether a shortcut applies. */
export interface KeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: unknown;
  preventDefault(): void;
}

/** Elements whose keystrokes are text: the shortcuts of the page leave them alone. */
export function isEditable(target: unknown): boolean {
  if (typeof target !== "object" || target === null) {
    return false;
  }
  // An object, as checked above; both properties are read as unknown and tested before use.
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  return (
    element.isContentEditable === true ||
    (typeof element.tagName === "string" &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName.toUpperCase()))
  );
}
