import type { ZoneStat } from "./lib/zones.js";

function percentCell(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function deltaCell(cell: HTMLTableCellElement, delta: number | null): void {
  cell.className = "delta";
  if (delta === null) {
    cell.textContent = "—";
    return;
  }
  cell.classList.add(delta >= 0 ? "up" : "down");
  const sign = delta >= 0 ? "+" : "−";
  cell.textContent = `${sign}${(Math.abs(delta) * 100).toFixed(1)}`;
}

function bodyRow(stat: ZoneStat, showPool: boolean): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const cells = [stat.zone, stat.fga.toLocaleString(), stat.fgm.toLocaleString(), percentCell(stat.pct)];
  if (showPool) cells.push(percentCell(stat.poolPct));
  for (const text of cells) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }
  if (showPool) {
    const delta = document.createElement("td");
    deltaCell(delta, stat.delta);
    tr.appendChild(delta);
  }
  return tr;
}

/**
 * Zone rows plus a totals footer. Always all attempts: FG% needs makes and misses both.
 * `showPool` hides the All-Stars/Diff columns for the combined view, which would otherwise
 * compare the pool average with itself.
 */
export function renderZones(table: HTMLTableElement, rows: ZoneStat[], total: ZoneStat, showPool: boolean): void {
  table.replaceChildren();

  const labels = showPool ? ["Zone", "FGA", "FGM", "FG%", "All-Stars", "Diff"] : ["Zone", "FGA", "FGM", "FG%"];
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of labels) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  for (const stat of rows) tbody.appendChild(bodyRow(stat, showPool));

  const tfoot = document.createElement("tfoot");
  tfoot.appendChild(bodyRow(total, showPool));

  table.append(thead, tbody, tfoot);
}
