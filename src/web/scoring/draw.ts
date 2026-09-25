import {
  BAR_COLORS, BAR_GAP, MIN_INSIDE_NAME, NAME_COLOR, NAME_FONT, PAD_LEFT, PAD_RIGHT, PAD_TOP, RACE_HEIGHT, RACE_WIDTH,
  ROW_HEIGHT, VALUE_COLOR, VALUE_FONT,
} from "./config.js";
import type { Bar, Race } from "./lib/race.js";

const NAME_INSET = 12;
const LABEL_GAP = 10;

/** One frame: bars scaled to the current leader, names inside long bars, points after every bar. */
export function drawRace(ctx: CanvasRenderingContext2D, race: Race, bars: readonly Bar[], names: readonly string[]): void {
  const visible = bars.filter((b) => b.y < race.topN);
  const top = Math.max(1, ...visible.map((b) => b.value));
  const room = RACE_WIDTH - PAD_LEFT - PAD_RIGHT;
  ctx.save();
  ctx.clearRect(0, 0, RACE_WIDTH, RACE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, RACE_WIDTH, PAD_TOP + ROW_HEIGHT * race.topN);
  ctx.clip(); // a bar sliding in or out is cut at the last row, not drawn over the edge
  ctx.textBaseline = "middle";
  for (const b of visible) {
    const y = PAD_TOP + b.y * ROW_HEIGHT + BAR_GAP / 2;
    const h = ROW_HEIGHT - BAR_GAP;
    const w = Math.max(2, (b.value / top) * room);
    const mid = y + h / 2;
    const points = Math.round(b.value).toLocaleString("en-US");
    ctx.fillStyle = BAR_COLORS[b.player % BAR_COLORS.length];
    ctx.fillRect(PAD_LEFT, y, w, h);
    if (w >= MIN_INSIDE_NAME) {
      ctx.font = NAME_FONT;
      ctx.fillStyle = NAME_COLOR;
      ctx.fillText(names[b.player], PAD_LEFT + NAME_INSET, mid);
      ctx.font = VALUE_FONT;
      ctx.fillStyle = VALUE_COLOR;
      ctx.fillText(points, PAD_LEFT + w + LABEL_GAP, mid);
    } else {
      ctx.font = VALUE_FONT;
      ctx.fillStyle = VALUE_COLOR;
      ctx.fillText(`${names[b.player]}  ${points}`, PAD_LEFT + w + LABEL_GAP, mid);
    }
  }
  ctx.restore();
}
