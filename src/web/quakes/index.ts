import type { GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { REPO_URL } from "../shell/config.js";
import { shouldAutoplay } from "../shell/lib/rec.js";
import { mountShell } from "../shell/mount.js";
import { createPlayer } from "../shell/player.js";
import { DATA_BASE, GLOBE_SIZE, HOLD_MS, MAX_SLIDER_MAG, MIN_MAG, PLAY_MS } from "./config.js";
import { drawGlobe, makeGlobe } from "./draw.js";
import { decodeEvents, windowDays } from "./lib/data.js";
import type { QuakeFile } from "./lib/data.js";
import { atLeast, countThrough } from "./lib/filter.js";
import { applyDrag, rotationAt } from "./lib/globe.js";
import type { Drag } from "./lib/globe.js";
import { monthAt, windowLabel } from "./lib/window.js";

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const { rec, footerDetail } = mountShell("quakes");
const canvas = el<HTMLCanvasElement>("globe");
const dateLabel = el<HTMLOutputElement>("date-label");
const countLabel = el<HTMLOutputElement>("count-label");
const playButton = el<HTMLButtonElement>("play");
const magInput = el<HTMLInputElement>("min-mag");
const magLabel = el<HTMLOutputElement>("mag-label");
const errorBox = document.querySelector<HTMLElement>(".load-error");
if (!errorBox) throw new Error("missing .load-error");
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull) throw new Error("canvas 2d unavailable");
const ctx: CanvasRenderingContext2D = ctxOrNull;

// The data pins MIN_MAG (the slider's floor); MAX_SLIDER_MAG is the ceiling. Set before the slider is enabled.
// Also reset the value: a restored form value (Firefox on reload/back-forward) must not disagree with the
// MIN_MAG filter `run()` draws with below.
magInput.min = String(MIN_MAG);
magInput.max = String(MAX_SLIDER_MAG);
magInput.value = String(MIN_MAG);

type LandTopology = Topology<{ land: GeometryCollection }>;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${path}`);
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return (await response.json()) as T;
}

function sizeCanvas(): void {
  const ratio = window.devicePixelRatio || 1;
  const scale = (canvas.clientWidth * ratio) / GLOBE_SIZE;
  canvas.width = Math.round(GLOBE_SIZE * scale);
  canvas.height = canvas.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function run(file: QuakeFile, topo: LandTopology): void {
  const all = decodeEvents(file.events);
  const span = windowDays(file.start, file.end);
  const globe = makeGlobe(ctx, feature(topo, topo.objects.land) as GeoPermissibleObjects);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let quakes = atLeast(all, MIN_MAG);
  let drag: Drag = { lambda: 0, phi: 0 };
  sizeCanvas();

  const render = (day: number): void => {
    drawGlobe(ctx, globe, quakes, day, rotationAt(day, span, drag));
    dateLabel.textContent = monthAt(file.start, day, span);
    const n = countThrough(quakes, day);
    countLabel.textContent = `${n.toLocaleString("en-US")} quake${n === 1 ? "" : "s"}`;
    canvas.dataset.drawn = "true";
  };

  const player = createPlayer({
    playback: { span, playMs: PLAY_MS, holdMs: HOLD_MS },
    button: playButton,
    autoplay: shouldAutoplay(rec, reduced),
    render,
  });

  let last: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (event) => {
    last = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!last) return;
    drag = applyDrag(drag, event.clientX - last.x, event.clientY - last.y);
    last = { x: event.clientX, y: event.clientY };
    if (!player.playing) player.redraw();
  });
  const endDrag = (): void => {
    last = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  const showMag = (): void => {
    magLabel.textContent = `M${Number(magInput.value).toFixed(1)}+`;
  };
  magInput.addEventListener("input", () => {
    quakes = atLeast(all, Number(magInput.value));
    showMag();
    player.redraw();
  });
  // Watch the canvas, not the window: in record mode its box settles after the header mounts.
  new ResizeObserver(() => {
    sizeCanvas();
    player.redraw();
  }).observe(canvas);

  // The controls ship disabled, so input before the data arrives is not silently dropped.
  for (const control of [playButton, magInput]) control.disabled = false;
  showMag();
}

async function start(): Promise<void> {
  errorBox!.hidden = true;
  try {
    const [file, topo] = await Promise.all([getJson<QuakeFile>("quakes.json"), getJson<LandTopology>("land.json")]);
    footerDetail.replaceChildren(
      `${file.source}, ${windowLabel(file.start, file.end)}, pulled ${file.generatedAt.slice(0, 10)}. `,
      sourceLink(),
    );
    run(file, topo);
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
  errorBox!.replaceChildren("Couldn't load the quakes data.", retry);
  errorBox!.hidden = false;
}

void start();
