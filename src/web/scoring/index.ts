import { REPO_URL } from "../shell/config.js";
import { el, getJson, showLoadError, sourceLink } from "../shell/load.js";
import { shouldAutoplay } from "../shell/lib/rec.js";
import { mountShell } from "../shell/mount.js";
import { createPlayer } from "../shell/player.js";
import { DATA_BASE, HOLD_MS, RACE_HEIGHT, RACE_WIDTH, SEASON_MS } from "./config.js";
import { drawRace } from "./draw.js";
import { barsAt, buildRace, seasonIndexAt, startNote } from "./lib/race.js";
import type { ScoringFile } from "./lib/race.js";

const { rec, footerDetail } = mountShell("scoring");
const canvas = el<HTMLCanvasElement>("race");
const seasonLabel = el<HTMLOutputElement>("season-label");
const playButton = el<HTMLButtonElement>("play");
const seasonInput = el<HTMLInputElement>("season");
const note = el("start-note");
const errorBox = document.querySelector<HTMLElement>(".load-error");
if (!errorBox) throw new Error("missing .load-error");
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull) throw new Error("canvas 2d unavailable");
const ctx: CanvasRenderingContext2D = ctxOrNull;

function sizeCanvas(): void {
  const ratio = window.devicePixelRatio || 1;
  const scale = (canvas.clientWidth * ratio) / RACE_WIDTH;
  canvas.width = Math.round(RACE_WIDTH * scale);
  canvas.height = Math.round(RACE_HEIGHT * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function run(file: ScoringFile): void {
  const race = buildRace(file.players, file.seasons.length, file.topN);
  const names = file.players.map((p) => p.name);
  const start = file.startSeason;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastSeason = -1;
  seasonInput.min = String(start);
  seasonInput.max = String(race.last);
  note.textContent = startNote(file);
  sizeCanvas();

  // The player counts seasons from the start season; the race and the labels count from 1946-47.
  const render = (offset: number): void => {
    const position = start + offset;
    drawRace(ctx, race, barsAt(race, position), names);
    const season = seasonIndexAt(position, race.last);
    if (season !== lastSeason) {
      seasonLabel.textContent = file.seasons[season];
      seasonInput.value = String(season);
      lastSeason = season;
    }
    canvas.dataset.drawn = "true";
  };

  const span = race.last - start;
  const player = createPlayer({
    playback: { span, playMs: span * SEASON_MS, holdMs: HOLD_MS },
    button: playButton,
    autoplay: shouldAutoplay(rec, reduced),
    render,
  });

  seasonInput.addEventListener("input", () => player.seek(Number(seasonInput.value) - start));
  // Watch the canvas, not the window: in record mode its box settles after the header mounts.
  new ResizeObserver(() => {
    sizeCanvas();
    player.redraw();
  }).observe(canvas);

  // The controls ship disabled, so input before the data arrives is not silently dropped.
  for (const control of [playButton, seasonInput]) control.disabled = false;
}

async function start(): Promise<void> {
  errorBox!.hidden = true;
  try {
    const file = await getJson<ScoringFile>(DATA_BASE, "scoring.json");
    footerDetail.replaceChildren(
      `${file.source}, through ${file.seasons[file.seasons.length - 1]}, pulled ${file.generatedAt.slice(0, 10)}. `,
      sourceLink(REPO_URL),
    );
    run(file);
  } catch (error) {
    console.error(error);
    showLoadError(errorBox!, "scoring", () => void start());
  }
}

void start();
