import {
  AIRPORT_COLOR, AIRPORT_RADIUS, ARC_COLOR, DOT_COLOR, DOT_RADIUS, MAP_HEIGHT, MAP_WIDTH, SELECTED_COLOR,
  SELECTED_RADIUS, SELECTED_RING_WIDTH, STATE_BORDER_WIDTH, STATE_FILL, STATE_STROKE,
} from "./config.js";
import { dotTs, pointAt } from "./lib/arcs.js";
import type { Measured, Point } from "./lib/arcs.js";

export interface Arc {
  a: number;
  b: number;
  width: number;
  path: Path2D;
  measured: Measured;
  dots: number;
}

export interface FlightScene {
  states: Path2D;
  borders: Path2D;
  /** Thinnest first, so the busiest routes draw on top. */
  arcs: Arc[];
  /** Airport positions in map units, indexed like the file's airports. */
  airports: Point[];
}

/** One frame at a loop phase (0..1). With an airport selected (>= 0), only its routes are drawn. */
export function drawFlights(ctx: CanvasRenderingContext2D, scene: FlightScene, phase: number, selected: number): void {
  const shown = selected < 0 ? scene.arcs : scene.arcs.filter((arc) => arc.a === selected || arc.b === selected);
  ctx.save();
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.fillStyle = STATE_FILL;
  ctx.fill(scene.states);
  ctx.strokeStyle = STATE_STROKE;
  ctx.lineWidth = STATE_BORDER_WIDTH;
  ctx.stroke(scene.borders);

  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = ARC_COLOR;
  ctx.lineCap = "round";
  for (const arc of shown) {
    ctx.lineWidth = arc.width;
    ctx.stroke(arc.path);
  }
  ctx.fillStyle = DOT_COLOR;
  ctx.beginPath(); // every dot in one path: thousands of fills per frame is the slow part
  for (const arc of shown) {
    for (const t of dotTs(arc.dots, phase)) {
      const [x, y] = pointAt(arc.measured, t);
      ctx.moveTo(x + DOT_RADIUS, y);
      ctx.arc(x, y, DOT_RADIUS, 0, 2 * Math.PI);
    }
  }
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = AIRPORT_COLOR;
  ctx.beginPath();
  for (const [x, y] of scene.airports) {
    ctx.moveTo(x + AIRPORT_RADIUS, y);
    ctx.arc(x, y, AIRPORT_RADIUS, 0, 2 * Math.PI);
  }
  ctx.fill();
  if (selected >= 0) {
    const [x, y] = scene.airports[selected];
    ctx.strokeStyle = SELECTED_COLOR;
    ctx.lineWidth = SELECTED_RING_WIDTH;
    ctx.beginPath();
    ctx.arc(x, y, SELECTED_RADIUS, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}
