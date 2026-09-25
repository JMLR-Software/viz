import { BAR_COLORS, BAR_GAP, MIN_INSIDE_NAME, NAME_COLOR, PAD_LEFT, PAD_RIGHT, PAD_TOP, RACE_WIDTH, VALUE_COLOR } from "./config.js";
import type { Bar, Race } from "./lib/race.js";

const NAME_INSET = 12;
const LABEL_GAP = 10;

/** The logical frame a race is drawn in: width is shared, height and row sizing vary between normal and record mode. */
export interface RaceFrame {
  height: number;
  rowHeight: number;
  nameFont: string;
  valueFont: string;
}

/** One frame: bars scaled to the current leader, names inside long bars when they fit, points after every bar. */
export function drawRace(
  ctx: CanvasRenderingContext2D, race: Race, bars: readonly Bar[], names: readonly string[], colors: readonly number[],
  frame: RaceFrame,
): void {
  const visible = bars.filter((b) => b.y < race.topN);
  const top = Math.max(1, ...visible.map((b) => b.value));
  const room = RACE_WIDTH - PAD_LEFT - PAD_RIGHT;
  ctx.save();
  ctx.clearRect(0, 0, RACE_WIDTH, frame.height);
  ctx.beginPath();
  ctx.rect(0, 0, RACE_WIDTH, PAD_TOP + frame.rowHeight * race.topN);
  ctx.clip(); // a bar sliding in or out is cut at the last row, not drawn over the edge
  ctx.textBaseline = "middle";
  for (const b of visible) {
    const y = PAD_TOP + b.y * frame.rowHeight + BAR_GAP / 2;
    const h = frame.rowHeight - BAR_GAP;
    const w = Math.max(2, (b.value / top) * room);
    const mid = y + h / 2;
    const points = Math.round(b.value).toLocaleString("en-US");
    const name = names[b.player];
    ctx.fillStyle = BAR_COLORS[colors[b.player]];
    ctx.fillRect(PAD_LEFT, y, w, h);
    ctx.font = frame.nameFont;
    // Measured at draw time, so a bar is only claimed as "inside" once the name actually fits it, in this font.
    const insideWidth = ctx.measureText(name).width + 2 * NAME_INSET;
    if (w >= MIN_INSIDE_NAME && w >= insideWidth) {
      ctx.fillStyle = NAME_COLOR;
      ctx.fillText(name, PAD_LEFT + NAME_INSET, mid);
      ctx.font = frame.valueFont;
      ctx.fillStyle = VALUE_COLOR;
      ctx.fillText(points, PAD_LEFT + w + LABEL_GAP, mid);
    } else {
      ctx.font = frame.valueFont;
      ctx.fillStyle = VALUE_COLOR;
      ctx.fillText(`${name}  ${points}`, PAD_LEFT + w + LABEL_GAP, mid);
    }
  }
  ctx.restore();
}
