import { COURT, COURT_WIDTH, courtToSvg, svgHeight } from "./lib/court.js";

/** Draw the half-court lines. Safe to call repeatedly; the previous court is replaced. */
export function drawCourt(svg: SVGSVGElement, width: number): void {
  const height = svgHeight(width);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.querySelector(".court")?.remove();

  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "court");

  const p = (x: number, y: number) => courtToSvg(x, y, width);
  const scale = width / COURT_WIDTH;

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const a = p(x1, y1);
    const b = p(x2, y2);
    const el = document.createElementNS(ns, "line");
    el.setAttribute("x1", String(a.x));
    el.setAttribute("y1", String(a.y));
    el.setAttribute("x2", String(b.x));
    el.setAttribute("y2", String(b.y));
    g.appendChild(el);
  };

  const circle = (cx: number, cy: number, r: number) => {
    const c = p(cx, cy);
    const el = document.createElementNS(ns, "circle");
    el.setAttribute("cx", String(c.x));
    el.setAttribute("cy", String(c.y));
    el.setAttribute("r", String(r * scale));
    g.appendChild(el);
  };

  /** An arc of the given court radius, swept between two court points above the hoop. */
  const arc = (fromX: number, fromY: number, toX: number, toY: number, r: number) => {
    const a = p(fromX, fromY);
    const b = p(toX, toY);
    const el = document.createElementNS(ns, "path");
    el.setAttribute("d", `M ${a.x} ${a.y} A ${r * scale} ${r * scale} 0 0 1 ${b.x} ${b.y}`);
    g.appendChild(el);
  };

  // Outline: baseline, sidelines, half-court line.
  line(-COURT.sidelineX, COURT.baselineY, COURT.sidelineX, COURT.baselineY);
  line(-COURT.sidelineX, COURT.baselineY, -COURT.sidelineX, COURT.halfCourtY);
  line(COURT.sidelineX, COURT.baselineY, COURT.sidelineX, COURT.halfCourtY);
  line(-COURT.sidelineX, COURT.halfCourtY, COURT.sidelineX, COURT.halfCourtY);
  circle(0, COURT.halfCourtY, COURT.centerCircleRadius);

  // The lane and the free-throw circle.
  line(-COURT.laneHalfWidth, COURT.baselineY, -COURT.laneHalfWidth, COURT.freeThrowY);
  line(COURT.laneHalfWidth, COURT.baselineY, COURT.laneHalfWidth, COURT.freeThrowY);
  line(-COURT.laneHalfWidth, COURT.freeThrowY, COURT.laneHalfWidth, COURT.freeThrowY);
  circle(0, COURT.freeThrowY, COURT.freeThrowRadius);

  // Rim, backboard, restricted area.
  circle(0, 0, COURT.rimRadius);
  line(-30, COURT.backboardY, 30, COURT.backboardY);
  arc(-COURT.restrictedRadius, 0, COURT.restrictedRadius, 0, COURT.restrictedRadius);

  // Three-point line: two corners and the arc between them.
  line(-COURT.cornerThreeX, COURT.baselineY, -COURT.cornerThreeX, COURT.cornerThreeY);
  line(COURT.cornerThreeX, COURT.baselineY, COURT.cornerThreeX, COURT.cornerThreeY);
  arc(-COURT.cornerThreeX, COURT.cornerThreeY, COURT.cornerThreeX, COURT.cornerThreeY, COURT.threeRadius);

  svg.insertBefore(g, svg.firstChild);
}
