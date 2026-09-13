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

function bodyRow(stat: ZoneStat): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const cells = [stat.zone, stat.fga.toLocaleString(), stat.fgm.toLocaleString(), percentCell(stat.pct), percentCell(stat.poolPct)];
  for (const text of cells) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }
  const delta = document.createElement("td");
  deltaCell(delta, stat.delta);
  tr.appendChild(delta);
  return tr;
}

/** Zone rows plus a totals footer. Always all attempts: FG% needs makes and misses both. */
export function renderZones(table: HTMLTableElement, rows: ZoneStat[], total: ZoneStat): void {
  table.replaceChildren();

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Zone", "FGA", "FGM", "FG%", "All-Stars", "Diff"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  for (const stat of rows) tbody.appendChild(bodyRow(stat));

  const tfoot = document.createElement("tfoot");
  tfoot.appendChild(bodyRow(total));

  table.append(thead, tbody, tfoot);
}
