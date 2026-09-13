import { HEADSHOT_URL } from "./config.js";
import { pct } from "./lib/data.js";
import type { PlayerEntry, SeasonType, Totals } from "./lib/data.js";

export type Selection = number | "all";
export type SortKey = "fga" | "pct";

/** Sort by the chosen key for the chosen season type; players with no attempts go last. */
export function sortPlayers(players: PlayerEntry[], season: SeasonType, sort: SortKey): PlayerEntry[] {
  return [...players].sort((a, b) => {
    const ta = a[season];
    const tb = b[season];
    if (ta.fga === 0 || tb.fga === 0) return (tb.fga === 0 ? 0 : 1) - (ta.fga === 0 ? 0 : 1);
    if (sort === "fga") return tb.fga - ta.fga;
    return (pct(tb) ?? 0) - (pct(ta) ?? 0);
  });
}

function totalsLabel(t: Totals): string {
  const p = pct(t);
  return p === null ? "no shots" : `${t.fga.toLocaleString()} FGA · ${(p * 100).toFixed(1)}%`;
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function row(
  key: Selection,
  name: string,
  meta: string,
  totals: Totals,
  selected: Selection,
  onSelect: (s: Selection) => void,
  headshot: string | null,
): HTMLLIElement {
  const li = document.createElement("li");
  li.setAttribute("aria-selected", String(key === selected));
  if (totals.fga === 0) li.classList.add("empty");

  const button = document.createElement("button");
  button.type = "button";

  if (headshot) {
    const img = document.createElement("img");
    img.src = headshot;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = initials(name);
      img.replaceWith(badge);
    });
    button.appendChild(img);
  } else {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "ALL";
    button.appendChild(badge);
  }

  const who = document.createElement("span");
  who.className = "who";
  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = name;
  const metaEl = document.createElement("span");
  metaEl.className = "meta";
  metaEl.textContent = `${meta}${meta ? " · " : ""}${totalsLabel(totals)}`;
  who.append(nameEl, metaEl);
  button.appendChild(who);

  button.addEventListener("click", () => onSelect(key));
  li.appendChild(button);
  return li;
}

/** Render the rail: the combined entry first, then players in the chosen order. */
export function renderPlayers(
  list: HTMLUListElement,
  players: PlayerEntry[],
  pool: Totals,
  season: SeasonType,
  sort: SortKey,
  selected: Selection,
  onSelect: (s: Selection) => void,
): void {
  list.replaceChildren();
  list.appendChild(row("all", "All All-Stars", "28 players", pool, selected, onSelect, null));
  for (const p of sortPlayers(players, season, sort)) {
    list.appendChild(row(p.id, p.name, p.team, p[season], selected, onSelect, HEADSHOT_URL(p.id)));
  }
}
