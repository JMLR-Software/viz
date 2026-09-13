import { COURT_SVG_WIDTH, DATA_BASE, HEX_RADIUS, ZONES } from "./config.js";
import { drawCourt } from "./court.js";
import { drawHexes, legendText } from "./heatmap.js";
import type { Mode } from "./heatmap.js";
import { decodeShots, zonePercentages } from "./lib/data.js";
import type { IndexFile, ResultFilter, SeasonType, Shot, ShotsFile, Totals } from "./lib/data.js";
import { filterShots } from "./lib/filter.js";
import { binShots } from "./lib/hexes.js";
import { zoneStats } from "./lib/zones.js";
import { renderPlayers } from "./players.js";
import type { Selection, SortKey } from "./players.js";
import { renderZones } from "./zone-table.js";

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const playersList = el<HTMLUListElement>("players");
const courtSvg = document.getElementById("court") as SVGSVGElement | null;
const tooltip = el("tooltip");
const summary = el("summary");
const legend = el("legend");
const errorBox = el("error");
const emptyBox = el("empty");
const zonesTable = el<HTMLTableElement>("zones");
const footer = el("footer");
const seasonSelect = el<HTMLSelectElement>("season");
const modeSelect = el<HTMLSelectElement>("mode");
const resultSelect = el<HTMLSelectElement>("result");
const sortSelect = el<HTMLSelectElement>("sort");

interface State {
  index: IndexFile | null;
  selected: Selection;
  season: SeasonType;
  mode: Mode;
  result: ResultFilter;
  sort: SortKey;
}

const state: State = {
  index: null,
  selected: readHash(),
  season: "regular",
  mode: "frequency",
  result: "all",
  sort: "fga",
};

const cache = new Map<string, ShotsFile>();

function readHash(): Selection {
  const match = /[#&]p=([^&]+)/.exec(window.location.hash);
  if (!match) return "all";
  const value = decodeURIComponent(match[1]);
  return value === "all" ? "all" : Number(value) || "all";
}

function writeHash(selection: Selection): void {
  const next = `#p=${selection}`;
  if (window.location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

async function loadShots(selection: Selection): Promise<ShotsFile> {
  const key = String(selection);
  const cached = cache.get(key);
  if (cached) return cached;
  const url = selection === "all" ? `${DATA_BASE}/all.json` : `${DATA_BASE}/players/${selection}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  const file = (await response.json()) as ShotsFile;
  cache.set(key, file);
  return file;
}

function nameFor(selection: Selection): string {
  if (selection === "all") return "All All-Stars";
  return state.index?.players.find((p) => p.id === selection)?.name ?? "this player";
}

function totalsFor(selection: Selection): Totals {
  if (!state.index) return { fga: 0, fgm: 0 };
  if (selection === "all") return state.index.pool[state.season];
  const player = state.index.players.find((p) => p.id === selection);
  return player ? player[state.season] : { fga: 0, fgm: 0 };
}

function seasonWord(): string {
  return state.season === "regular" ? "regular-season" : "playoff";
}

function renderSummary(): void {
  const totals = totalsFor(state.selected);
  const label = seasonWord();
  const team = state.selected === "all"
    ? `${state.index?.players.length ?? 0} players`
    : state.index?.players.find((p) => p.id === state.selected)?.team ?? "";
  const shooting = totals.fga === 0
    ? `no ${label} shots`
    : `${totals.fga.toLocaleString()} FGA · ${((totals.fgm / totals.fga) * 100).toFixed(1)}% FG`;
  summary.textContent = `${nameFor(state.selected)} · ${team} · ${shooting}`;
}

function render(shots: Shot[]): void {
  if (!courtSvg || !state.index) return;

  const pool = state.index.pool[state.season];
  const poolPct = zonePercentages(pool.zones);

  drawCourt(courtSvg, COURT_SVG_WIDTH);

  const visible = state.mode === "efficiency" ? shots : filterShots(shots, state.result);
  drawHexes(courtSvg, tooltip, binShots(visible, HEX_RADIUS, poolPct), state.mode, COURT_SVG_WIDTH, HEX_RADIUS);

  if (shots.length === 0) {
    emptyBox.textContent = `No ${seasonWord()} shots for ${nameFor(state.selected)}.`;
    emptyBox.hidden = false;
  } else {
    emptyBox.hidden = true;
  }

  legend.textContent = legendText(state.mode);
  const { rows, total } = zoneStats(shots, pool.zones, ZONES);
  renderZones(zonesTable, rows, total);
  renderSummary();
}

function renderRail(): void {
  if (!state.index) return;
  renderPlayers(
    playersList,
    state.index.players,
    state.index.pool[state.season],
    state.season,
    state.sort,
    state.selected,
    select,
  );
}

function showError(message: string): void {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError(): void {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

let pending = 0;

async function refresh(): Promise<void> {
  if (!state.index) return;
  const token = ++pending;
  clearError();
  try {
    const file = await loadShots(state.selected);
    if (token !== pending) return;
    render(decodeShots(file[state.season]));
  } catch (error) {
    if (token !== pending) return;
    console.error(error);
    emptyBox.hidden = true;
    if (courtSvg) {
      drawCourt(courtSvg, COURT_SVG_WIDTH);
      drawHexes(courtSvg, tooltip, [], state.mode, COURT_SVG_WIDTH, HEX_RADIUS);
    }
    showError(`Couldn't load shots for ${nameFor(state.selected)}. Reload to try again.`);
  }
}

function select(selection: Selection): void {
  state.selected = selection;
  writeHash(selection);
  renderRail();
  void refresh();
}

function syncResultControl(): void {
  const efficiency = state.mode === "efficiency";
  resultSelect.disabled = efficiency;
  if (efficiency) {
    resultSelect.value = "all";
    state.result = "all";
  }
}

seasonSelect.addEventListener("change", () => {
  state.season = seasonSelect.value as SeasonType;
  renderRail();
  void refresh();
});

modeSelect.addEventListener("change", () => {
  state.mode = modeSelect.value as Mode;
  syncResultControl();
  void refresh();
});

resultSelect.addEventListener("change", () => {
  state.result = resultSelect.value as ResultFilter;
  void refresh();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value as SortKey;
  renderRail();
});

async function start(): Promise<void> {
  try {
    const response = await fetch(`${DATA_BASE}/index.json`);
    if (!response.ok) throw new Error(`index.json -> ${response.status}`);
    state.index = (await response.json()) as IndexFile;
  } catch (error) {
    console.error(error);
    showError("Couldn't load the shot data. Reload to try again.");
    return;
  }

  const date = state.index.generatedAt.slice(0, 10);
  footer.textContent = `Data: NBA.com/stats via nba_api, pulled ${date}. Not affiliated with the NBA.`;

  syncResultControl();
  renderRail();
  await refresh();
}

void start();
