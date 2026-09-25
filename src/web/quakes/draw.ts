import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import type { GeoPath, GeoPermissibleObjects, GeoProjection } from "d3-geo";
import {
  GLOBE_MARGIN, GLOBE_SIZE, GRATICULE_STROKE, LAND_FILL, OCEAN_FILL, QUAKE_COLOR, RIM_STROKE, RING_WIDTH,
} from "./config.js";
import type { Quake } from "./lib/data.js";
import { countThrough } from "./lib/filter.js";
import { onNearSide } from "./lib/globe.js";
import { markAt } from "./lib/ripple.js";

export interface Globe {
  projection: GeoProjection;
  path: GeoPath<unknown, GeoPermissibleObjects>;
  land: GeoPermissibleObjects;
  graticule: GeoPermissibleObjects;
}

const SPHERE: GeoPermissibleObjects = { type: "Sphere" };

export function makeGlobe(ctx: CanvasRenderingContext2D, land: GeoPermissibleObjects): Globe {
  const projection = geoOrthographic()
    .scale(GLOBE_SIZE / 2 - GLOBE_MARGIN)
    .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
    .clipAngle(90);
  return { projection, path: geoPath(projection, ctx), land, graticule: geoGraticule10() };
}

/** One frame: ocean, graticule, land, rim, then every quake so far that faces the viewer. */
export function drawGlobe(
  ctx: CanvasRenderingContext2D,
  globe: Globe,
  quakes: readonly Quake[],
  day: number,
  rotate: [number, number],
): void {
  globe.projection.rotate(rotate);
  ctx.save();
  ctx.clearRect(0, 0, GLOBE_SIZE, GLOBE_SIZE);
  const shape = (object: GeoPermissibleObjects): void => {
    ctx.beginPath();
    globe.path(object);
  };
  shape(SPHERE);
  ctx.fillStyle = OCEAN_FILL;
  ctx.fill();
  shape(globe.graticule);
  ctx.strokeStyle = GRATICULE_STROKE;
  ctx.lineWidth = 0.5;
  ctx.stroke();
  shape(globe.land);
  ctx.fillStyle = LAND_FILL;
  ctx.fill();
  shape(SPHERE);
  ctx.strokeStyle = RIM_STROKE;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = QUAKE_COLOR;
  ctx.strokeStyle = QUAKE_COLOR;
  ctx.lineWidth = RING_WIDTH;
  const shown = countThrough(quakes, day);
  for (let i = 0; i < shown; i += 1) {
    const q = quakes[i];
    if (!onNearSide([q.lon, q.lat], rotate)) continue;
    const xy = globe.projection([q.lon, q.lat]);
    const mark = markAt(q, day);
    if (!xy || !mark) continue;
    ctx.globalAlpha = mark.dotAlpha;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], mark.r, 0, 2 * Math.PI);
    ctx.fill();
    if (mark.ringAlpha > 0) {
      ctx.globalAlpha = mark.ringAlpha;
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], mark.ringR, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
}
