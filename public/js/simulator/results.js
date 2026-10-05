// Panel Simulation Result: menampilkan hasil simulasi (tegangan dan arus tiap komponen).

import { COMPONENT_TYPES } from "./components.js";
import { formatSI } from "./solver.js";

function el(tag, attrs = {}, text = null) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text !== null) node.textContent = text;
  return node;
}

// results = hasil simulate() atau null kalau simulasi tidak berjalan.
export function renderResults(container, circuit, results) {
  container.replaceChildren();

  if (!results) {
    container.appendChild(el("p", { class: "hint" }, "Press \u25b6 Run Simulation to see voltages and currents."));
    return;
  }
  if (!results.ok) {
    const box = el("div", { class: "error-box" });
    box.appendChild(el("strong", {}, "Simulation error"));
    box.appendChild(el("p", {}, results.error));
    container.appendChild(box);
    return;
  }

  for (const warning of results.warnings) {
    const box = el("div", { class: "error-box sim-warning" });
    box.appendChild(el("p", {}, warning));
    container.appendChild(box);
  }

  const table = el("table", { class: "result-table" });
  const head = el("tr");
  for (const title of ["Component", "Voltage", "Current"]) head.appendChild(el("th", {}, title));
  table.appendChild(head);

  for (const c of circuit.components) {
    const r = results.components[c.id];
    if (!r || c.type === "ground") continue;
    const row = el("tr");
    row.appendChild(el("td", {}, `${COMPONENT_TYPES[c.type].label} ${c.id}`));
    row.appendChild(el("td", {}, r.voltage === undefined ? "\u2013" : formatSI(r.voltage, "V")));
    row.appendChild(el("td", {}, r.current === undefined ? "\u2013" : formatSI(r.current, "A")));
    table.appendChild(row);
  }
  container.appendChild(table);
  container.appendChild(
    el("p", { class: "hint sim-note" }, "DC steady state: a capacitor acts as an open circuit. Current is shown from the first terminal to the second.")
  );
}

"DC steady state: a capacitor acts as an open circuit. Current is shown from the first terminal to the second. For a transistor, voltage is Vce (Vec for PNP) and current is the collector current."