import { FLASH_FADE_YEARS, STATE_STROKE, STRONG_MIN_MAG, TRACK_COLOR } from "./config.js";
import type { Track } from "./lib/data.js";
import { trackWidth } from "./lib/scale.js";
import { yearIndexAt, trackAlpha } from "./lib/timeline.js";
import { countAt } from "./lib/totals.js";

export interface County {
  fips: string;
  name: string;
  path: Path2D;
}

export interface Heat {
  cumulative: ReadonlyMap<string, Int32Array>;
  /** The colour domain's top; counts above it share its colour. */
  max: number;
  color: (count: number) => string;
}

export interface Scene {
  years: number;
  counties: County[];
  states: Path2D;
  tracks: Track[][];
  all: Heat;
  strong: Heat;
}

/** Draw one frame at `position` (years since the first year). The ctx transform maps map units to device pixels. */
export function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, position: number, strongOnly: boolean): void {
  const heat = strongOnly ? scene.strong : scene.all;
  const yearIndex = yearIndexAt(position, scene.years);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const county of scene.counties) {
    ctx.fillStyle = heat.color(countAt(heat.cumulative, county.fips, yearIndex));
    ctx.fill(county.path);
  }
  ctx.strokeStyle = STATE_STROKE;
  ctx.lineWidth = 0.5;
  ctx.stroke(scene.states);

  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = TRACK_COLOR;
  ctx.lineCap = "round";
  const oldest = Math.max(0, Math.floor(position - 1 - FLASH_FADE_YEARS));
  for (let y = oldest; y <= yearIndex; y += 1) {
    const alpha = trackAlpha(y, position, FLASH_FADE_YEARS);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    for (const t of scene.tracks[y]) {
      if (strongOnly && t.mag < STRONG_MIN_MAG) continue;
      ctx.lineWidth = trackWidth(t.mag);
      ctx.beginPath();
      ctx.moveTo(t.x0, t.y0);
      ctx.lineTo(t.x1 + 0.01, t.y1); // a zero-length round-capped line draws a dot
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The county under a device-pixel point, or null. isPointInPath applies the current transform. */
export function countyAt(ctx: CanvasRenderingContext2D, scene: Scene, px: number, py: number): County | null {
  return scene.counties.find((c) => ctx.isPointInPath(c.path, px, py)) ?? null;
}
