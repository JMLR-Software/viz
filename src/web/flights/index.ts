import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { REPO_URL } from "../shell/config.js";
import { el, getJson, showLoadError, sourceLink } from "../shell/load.js";
import { shouldAutoplay } from "../shell/lib/rec.js";
import { mountShell } from "../shell/mount.js";
import { createPlayer } from "../shell/player.js";
import {
  ALBERS_SCALE, ALBERS_TRANSLATE, ARC_STEPS, DATA_BASE, MAP_HEIGHT, MAP_WIDTH, TAP_RADIUS, TAP_RADIUS_PX, TRAVEL_MS,
} from "./config.js";
import { drawFlights } from "./draw.js";
import type { Arc, FlightScene } from "./draw.js";
import { arcPoints, measure } from "./lib/arcs.js";
import type { Point, Project } from "./lib/arcs.js";
import { decodeRoutes } from "./lib/data.js";
import type { FlightFile, Route } from "./lib/data.js";
import { airportSummary, nearestAirport } from "./lib/pick.js";
import { dotCount, widthFor } from "./lib/scale.js";

const { rec, footerDetail } = mountShell("flights");
const canvas = el<HTMLCanvasElement>("map");
const playButton = el<HTMLButtonElement>("play");
const airportInfo = el("airport-info");
const errorBox = document.querySelector<HTMLElement>(".load-error");
if (!errorBox) throw new Error("missing .load-error");
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull) throw new Error("canvas 2d unavailable");
const ctx: CanvasRenderingContext2D = ctxOrNull;

type StatesTopology = Topology<{ states: GeometryCollection }>;

/** Alaska, Hawaii and Puerto Rico: no route in the data touches them, so they'd sit empty in their insets. */
const OFF_MAP_STATE_IDS = new Set(["02", "15", "72"]);

function lower48States(topo: StatesTopology): GeometryCollection {
  return {
    ...topo.objects.states,
    geometries: topo.objects.states.geometries.filter((g) => !OFF_MAP_STATE_IDS.has(String(g.id))),
  };
}

function buildScene(file: FlightFile, routes: readonly Route[], topo: StatesTopology): FlightScene {
  const albers = geoAlbersUsa().scale(ALBERS_SCALE).translate([...ALBERS_TRANSLATE]);
  const project: Project = (lonLat) => albers(lonLat);
  const path = geoPath(); // the atlas is already projected into the 975x610 frame
  const lonLat = (i: number): Point => [file.airports[i].lon, file.airports[i].lat];
  const max = routes.reduce((m, r) => Math.max(m, r.passengers), 1);
  const states = lower48States(topo);
  const arcs: Arc[] = routes
    .map((r) => {
      const points = arcPoints(lonLat(r.a), lonLat(r.b), ARC_STEPS, project);
      if (points.length < 2) return null;
      const line = new Path2D();
      points.forEach(([x, y], k) => (k === 0 ? line.moveTo(x, y) : line.lineTo(x, y)));
      return { a: r.a, b: r.b, width: widthFor(r.passengers, max), path: line, measured: measure(points), dots: dotCount(r.departures) };
    })
    .filter((arc): arc is Arc => arc !== null)
    .sort((x, y) => x.width - y.width);
  return {
    states: new Path2D(path(feature(topo, states)) ?? ""),
    borders: new Path2D(path(mesh(topo, states, (a, b) => a !== b)) ?? ""),
    arcs,
    airports: file.airports.map((_, i) => project(lonLat(i)) ?? [Number.NaN, Number.NaN]),
  };
}

function sizeCanvas(): void {
  const ratio = window.devicePixelRatio || 1;
  const scale = (canvas.clientWidth * ratio) / MAP_WIDTH;
  canvas.width = Math.round(MAP_WIDTH * scale);
  canvas.height = Math.round(MAP_HEIGHT * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function describe(file: FlightFile, routes: readonly Route[], airport: number): string {
  const a = file.airports[airport];
  const { routes: n, passengers } = airportSummary(routes, airport);
  return `${a.code}, ${a.city}: ${n} of the top ${routes.length.toLocaleString("en-US")} routes, ` +
    `carrying ${passengers.toLocaleString("en-US")} passengers in ${file.year}`;
}

function run(file: FlightFile, topo: StatesTopology): void {
  const routes = decodeRoutes(file.routes);
  const scene = buildScene(file, routes, topo);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let selected = -1;
  sizeCanvas();

  const render = (phase: number): void => {
    drawFlights(ctx, scene, phase, selected);
    canvas.dataset.drawn = "true";
  };

  // The dots loop forever: one pass is a phase from 0 to 1, with no hold.
  const player = createPlayer({
    playback: { span: 1, playMs: TRAVEL_MS, holdMs: 0 },
    button: playButton,
    autoplay: shouldAutoplay(rec, reduced),
    render,
  });

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    const reach = Math.max(TAP_RADIUS, (TAP_RADIUS_PX * MAP_WIDTH) / rect.width);
    selected = nearestAirport(scene.airports, x, y, reach);
    airportInfo.textContent = selected < 0 ? "" : describe(file, routes, selected);
    player.redraw();
  });
  // Watch the canvas, not the window: in record mode its box settles after the header mounts.
  new ResizeObserver(() => {
    sizeCanvas();
    player.redraw();
  }).observe(canvas);

  // The controls ship disabled, so input before the data arrives is not silently dropped.
  playButton.disabled = false;
}

async function start(): Promise<void> {
  errorBox!.hidden = true;
  try {
    const [file, topo] = await Promise.all([
      getJson<FlightFile>(DATA_BASE, "flights.json"),
      getJson<StatesTopology>(DATA_BASE, "states.json"),
    ]);
    const shown = file.routes.length / file.routeFields.length;
    footerDetail.replaceChildren(
      `${file.source}. The ${shown.toLocaleString("en-US")} busiest of ${file.pairs.toLocaleString("en-US")} airport ` +
        "pairs inside the lower 48, both directions summed; routes to Alaska, Hawaii and the territories are left out " +
        `because the map's insets can't carry a great circle. Pulled ${file.generatedAt.slice(0, 10)}. `,
      sourceLink(REPO_URL),
    );
    run(file, topo);
  } catch (error) {
    console.error(error);
    showLoadError(errorBox!, "flights", () => void start());
  }
}

void start();
