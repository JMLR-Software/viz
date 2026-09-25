import { HOME_CREDIT, WORDMARK } from "./config.js";
import { isRecording, withRec } from "./lib/rec.js";
import { SHOWCASES, showcaseFor } from "./registry.js";

const byId = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
};

function buildDropdown(current: string | null, rec: boolean): HTMLSelectElement {
  const select = document.createElement("select");
  select.id = "showcase";
  select.setAttribute("aria-label", "Showcase");
  if (current === null) {
    const prompt = new Option("Pick a showcase", "", true, true);
    prompt.disabled = true;
    select.add(prompt);
  }
  for (const s of SHOWCASES) select.add(new Option(s.title, s.slug, false, s.slug === current));
  select.addEventListener("change", () => {
    window.location.assign(withRec(`/${select.value}/`, rec));
  });
  // Back/forward cache restores the select as the viewer left it; name this page again.
  window.addEventListener("pageshow", () => {
    select.value = current ?? "";
  });
  return select;
}

/** Mount the shared header and footer. `slug` is null on the / grid. */
export function mountShell(slug: string | null): { rec: boolean; footerDetail: HTMLElement } {
  const rec = isRecording(window.location.search);
  document.documentElement.classList.toggle("rec", rec);

  const wordmark = document.createElement("a");
  wordmark.className = "wordmark";
  wordmark.href = withRec("/", rec);
  wordmark.textContent = WORDMARK;

  const hook = document.createElement("p");
  hook.className = "hook";
  hook.textContent = slug === null ? "" : showcaseFor(slug).hook;

  byId("viz-header").replaceChildren(wordmark, buildDropdown(slug, rec), hook);

  const credit = document.createElement("span");
  credit.className = "credit";
  credit.textContent = slug === null ? HOME_CREDIT : showcaseFor(slug).credit;
  const footerDetail = document.createElement("span");
  footerDetail.className = "detail";
  byId("footer").replaceChildren(credit, " ", footerDetail);

  return { rec, footerDetail };
}
