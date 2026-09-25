/** Shared DOM/load helpers: look up a required element, fetch JSON, credit the source, and report a failed load. */

export const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

/** Fetch `${base}/${path}` as JSON, throwing with the path and status on a non-OK response. */
export async function getJson<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base}/${path}`);
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return (await response.json()) as T;
}

export function sourceLink(repoUrl: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = repoUrl;
  a.textContent = "Source";
  return a;
}

/** Show "Couldn't load the <showcase> data." with a Retry button that re-runs `retry` once. */
export function showLoadError(errorBox: HTMLElement, showcase: string, retry: () => void): void {
  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.textContent = "Retry";
  retryButton.addEventListener("click", retry, { once: true });
  errorBox.replaceChildren(`Couldn't load the ${showcase} data.`, retryButton);
  errorBox.hidden = false;
}
