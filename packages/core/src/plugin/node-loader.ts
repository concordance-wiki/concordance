export async function importPlugin(packageName: string): Promise<unknown> {
  // The specifier is data from the configuration: no bundler must try to resolve it ahead of time.
  const module: unknown = await import(/* @vite-ignore */ packageName);
  // A module namespace is always an object; a missing default export reads as undefined.
  return (module as { default?: unknown }).default;
}
