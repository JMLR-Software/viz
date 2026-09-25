import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { mountShell } from "../shell/mount.js";
import { REPO_URL } from "../shell/config.js";
import { shouldAutoplay } from "../shell/lib/rec.js";
import {
  ALBERS_SCALE, ALBERS_TRANSLATE, DATA_BASE, EMPTY_FILL, HEAT_PERCENTILE, HOLD_MS, MAP_HEIGHT, MAP_WIDTH, PLAY_MS,
} from "./config.js";
import { countyAt, drawFrame } from "./draw.js";
import { renderLegend } from "./legend.js";
import type { County, Scene } from "./draw.js";
import { decodeTracks } from "./lib/data.js";
import type { Project, TornadoFile } from "./lib/data.js";
import { heatScale } from "./lib/scale.js";
import { elapsedForPosition, positionAt, positionForYearIndex, yearIndexAt } from "./lib/timeline.js";
import type { Timeline } from "./lib/timeline.js";
import { buildCumulative, countAt, maxFinal } from "./lib/totals.js";

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const { rec, footerDetail } = mountShell("tornadoes");
const canvas = el<HTMLCanvasElement>("map");
const yearLabel = el<HTMLOutputElement>("year-label");
const playButton = el<HTMLButtonElement>("play");
const yearInput = el<HTMLInputElement>("year");
const strongInput = el<HTMLInputElement>("strong");
const countyInfo = el("county-info");
const legend = el("legend");
const errorBox = document.querySelector<HTMLElement>(".load-error");
if (!errorBox) throw new Error("missing .load-error");
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull) throw new Error("canvas 2d unavailable");
const ctx: CanvasRenderingContext2D = ctxOrNull;

type CountiesTopology = Topology<{ counties: GeometryCollection<{ name: string }>; states: GeometryCollection<{ name: string }> }>;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${path}`);
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return (await response.json()) as T;
}

function buildScene(file: TornadoFile, topo: CountiesTopology): Scene {
  const albers = geoAlbersUsa().scale(ALBERS_SCALE).translate([...ALBERS_TRANSLATE]);
  const project: Project = (lonLat) => albers(lonLat);
  const path = geoPath(); // the atlas is already projected into the 975x610 frame
  const stateNames = new Map(topo.objects.states.geometries.map((g) => [String(g.id), g.properties && "name" in g.properties ? g.properties.name : ""]));
  const counties: County[] = feature(topo, topo.objects.counties).features.map((f) => ({
    fips: String(f.id),
    name: `${f.properties.name}, ${stateNames.get(String(f.id).slice(0, 2)) ?? ""}`,
    path: new Path2D(path(f) ?? ""),
  }));
  const states = new Path2D(path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "");
  const years = file.lastYear - file.firstYear + 1;
  const { byYear, dropped } = decodeTracks(file.tracks, project);
  if (dropped > 0) console.info(`tornadoes: ${dropped} tracks outside the US map (PR, VI) not drawn`);
  const allCum = buildCumulative(file.counties, years, false);
  const strongCum = buildCumulative(file.counties, years, true);
  const allMax = maxFinal(allCum, HEAT_PERCENTILE);
  const strongMax = maxFinal(strongCum, HEAT_PERCENTILE);
  return {
    years,
    counties,
    states,
    tracks: byYear,
    all: { cumulative: allCum, max: allMax, color: heatScale(allMax, EMPTY_FILL) },
    strong: { cumulative: strongCum, max: strongMax, color: heatScale(strongMax, EMPTY_FILL) },
  };
}

function sizeCanvas(): number {
  const ratio = window.devicePixelRatio || 1;
  const scale = (canvas.clientWidth * ratio) / MAP_WIDTH;
  canvas.width = Math.round(MAP_WIDTH * scale);
  canvas.height = Math.round(MAP_HEIGHT * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return scale;
}

function run(file: TornadoFile, scene: Scene): void {
  const timeline: Timeline = { years: scene.years, playMs: PLAY_MS, holdMs: HOLD_MS };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let playing = shouldAutoplay(rec, reduced);
  let position = playing ? 0 : scene.years;
  let startedAt = performance.now();
  let lastYearIndex = -1;

  yearInput.max = String(scene.years - 1);
  sizeCanvas();

  const render = (): void => {
    drawFrame(ctx, scene, position, strongInput.checked);
    const yearIndex = yearIndexAt(position, scene.years);
    if (yearIndex !== lastYearIndex) {
      yearLabel.textContent = String(file.firstYear + yearIndex);
      yearInput.value = String(yearIndex);
      lastYearIndex = yearIndex;
    }
    canvas.dataset.drawn = "true";
  };

  const setPlaying = (next: boolean): void => {
    playing = next;
    playButton.textContent = playing ? "Pause" : "Play";
    if (playing) {
      startedAt = performance.now() - elapsedForPosition(position >= scene.years ? 0 : position, timeline);
      requestAnimationFrame(tick);
    }
  };

  const tick = (now: number): void => {
    if (!playing) return;
    position = positionAt(now - startedAt, timeline);
    render();
    requestAnimationFrame(tick);
  };

  playButton.addEventListener("click", () => setPlaying(!playing));
  yearInput.addEventListener("input", () => {
    setPlaying(false);
    position = positionForYearIndex(Number(yearInput.value));
    render();
  });
  const showLegend = (): void => renderLegend(legend, strongInput.checked ? scene.strong : scene.all, strongInput.checked);
  strongInput.addEventListener("change", () => {
    countyInfo.textContent = "";
    showLegend();
    render();
  });
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const county = countyAt(ctx, scene, px, py);
    if (!county) {
      countyInfo.textContent = "";
      return;
    }
    const heat = strongInput.checked ? scene.strong : scene.all;
    const yearIndex = yearIndexAt(position, scene.years);
    const n = countAt(heat.cumulative, county.fips, yearIndex);
    const rated = strongInput.checked ? " rated EF3+" : "";
    countyInfo.textContent = `${county.name}: ${n} tornado${n === 1 ? "" : "es"}${rated}, ${file.firstYear}–${file.firstYear + yearIndex}`;
  });
  window.addEventListener("resize", () => {
    sizeCanvas();
    render();
  });

  // The controls ship disabled, so input before the data arrives is not silently dropped.
  for (const control of [playButton, yearInput, strongInput]) control.disabled = false;
  showLegend();
  setPlaying(playing);
  render();
}

async function start(): Promise<void> {
  errorBox!.hidden = true;
  try {
    const [file, topo] = await Promise.all([
      getJson<TornadoFile>("tornadoes.json"),
      getJson<CountiesTopology>("counties.json"),
    ]);
    footerDetail.replaceChildren(`${file.source}, pulled ${file.generatedAt.slice(0, 10)}. `, sourceLink());
    run(file, buildScene(file, topo));
  } catch (error) {
    console.error(error);
    showLoadError();
  }
}

function sourceLink(): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = REPO_URL;
  a.textContent = "Source";
  return a;
}

function showLoadError(): void {
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => void start(), { once: true });
  errorBox!.replaceChildren("Couldn't load the tornadoes data.", retry);
  errorBox!.hidden = false;
}

void start();
