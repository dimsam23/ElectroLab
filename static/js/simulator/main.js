// main.js: Entry point for the circuit simulator.

import { createCircuit, addComponent, findFreeSpot, clearCircuit, getCircuitData, findComponent, rotateComponent, removeComponent, removeJunction, removeWire, addJunction, addWire } from "./circuit.js";
import { createCanvas } from "./canvas.js";
import { setupPalette } from "./palette.js";
import { setupInteraction, setHistoryCallback } from "./interaction.js";
import { createProperties } from "./properties.js";
import { simulate } from "./solver.js";
import { renderResults } from "./results.js";
import { createHistory, pushSnapshot, undo, redo, canUndo, canRedo } from "../simulator/history.js";
import { createClipboard, copyToClipboard, copyAllToClipboard, getClipboardData, hasClipboardData, clearClipboard } from "./clipboard.js";
import { getProject, createProject, updateProject } from "../projects/storage.js";
import { setupProjectTools } from "./projects.js";

// All these elements must exist in simulator.html. If any is missing, other code will error out
// mid-way: components appear but cannot be dragged, properties cannot be changed,
// and wires do not work. Checked upfront so the cause is immediately visible.
const REQUIRED_IDS = [
  "sim-canvas", "wires-layer", "components-layer", "preview-layer", "empty-hint",
  "palette", "sim-run", "sim-clear", "sim-count",
  "properties-panel", "results-panel", "wire-hint",
];
const missingIds = REQUIRED_IDS.filter((id) => !document.getElementById(id));
if (missingIds.length > 0) {
  const box = document.createElement("div");
  box.className = "error-box";
  box.innerHTML =
    "<strong>simulator.html is incomplete.</strong> The following elements were not found: " +
    missingIds.map((id) => `<code>#${id}</code>`).join(", ") +
    ". Please match simulator.html with the latest version and reload (Ctrl+F5).";
  (document.querySelector(".sim-layout") || document.body).before(box);
  throw new Error(`Elements not found in simulator.html: ${missingIds.join(", ")}`);
}

const circuit = createCircuit();
const canvas = createCanvas(document.getElementById("sim-canvas"));
const countLabel = document.getElementById("sim-count");
const runButton = document.getElementById("sim-run");
const resultsPanel = document.getElementById("results-panel");
const wireHint = document.getElementById("wire-hint");

// Initialize history and clipboard
const history = createHistory();
const clipboard = createClipboard();

// Display state (not part of the circuit data):
// selected = { kind: "component" | "junction" | "wire", id } | null
// preview  = { points } wire being drawn | null
// snap     = target endpoint being highlighted | null
// running  = whether simulation is running; results = simulate() results | null
// wiring   = whether a wiring session is active (to show hints above canvas)
const state = { selected: null, preview: null, snap: null, wiring: false, running: false, results: null };

const COLLECTIONS = { component: "components", junction: "junctions", wire: "wires" };

// If the selected item no longer exists (e.g. deleted/Clear), release selection.
function validateSelection() {
  const s = state.selected;
  if (!s) return;
  
  if (Array.isArray(s)) {
    // Filter array selection, remove missing items
    state.selected = s.filter((item) => {
      const coll = COLLECTIONS[item.kind];
      return coll && circuit[coll].some((i) => i.id === item.id);
    });
    if (state.selected.length === 0) state.selected = null;
  } else {
    // Single selection
    const coll = COLLECTIONS[s.kind];
    if (coll && !circuit[coll].some((item) => item.id === s.id)) {
      state.selected = null;
    }
  }
}

// Redraw canvas. panel=false is used during dragging or typing values,
// so the Properties panel is not rebuilt (input field keeps focus).
// When simulation is running, results are recalculated on every change (live).
function refresh({ panel = true } = {}) {
  validateSelection();
  state.results = state.running ? simulate(circuit) : null;
  canvas.render(circuit, state);
  renderResults(resultsPanel, circuit, state.results);
    wireHint.hidden = !state.wiring;

  const count = circuit.components.length;
  countLabel.textContent =
    `${count} component${count === 1 ? "" : "s"} \u00b7 ` +
    `${circuit.wires.length} wire${circuit.wires.length === 1 ? "" : "s"}`;
  if (panel) properties.render();
}

// Save current state to history.
function saveToHistory() {
  pushSnapshot(history, getCircuitData(circuit));
}

// Restore circuit from snapshot data.
function restoreFromSnapshot(data) {
  if (!data) return;
  circuit.components = JSON.parse(JSON.stringify(data.components));
  circuit.junctions = JSON.parse(JSON.stringify(data.junctions));
  circuit.wires = JSON.parse(JSON.stringify(data.wires));
  circuit.nextId = 1;
  circuit.nextJunctionId = 1;
  circuit.nextWireId = 1;
  for (const c of circuit.components) {
    const num = parseInt(c.id.slice(1));
    circuit.nextId = Math.max(circuit.nextId, num + 1);
  }
  for (const j of circuit.junctions) {
    const num = parseInt(j.id.slice(1));
    circuit.nextJunctionId = Math.max(circuit.nextJunctionId, num + 1);
  }
  for (const w of circuit.wires) {
    const num = parseInt(w.id.slice(1));
    circuit.nextWireId = Math.max(circuit.nextWireId, num + 1);
  }
  state.selected = null;
  refresh();
}

// Undo (Ctrl+Z)
function handleUndo() {
  const snapshot = undo(history);
  if (snapshot) {
    restoreFromSnapshot(snapshot);
  }
}

// Redo (Ctrl+Y)
function handleRedo() {
  const snapshot = redo(history);
  if (snapshot) {
    restoreFromSnapshot(snapshot);
  }
}

// Copy (Ctrl+C)
function handleCopy() {
  if (!state.selected) return;
  
  if (Array.isArray(state.selected)) {
    // Copy semua item yang dipilih
    copyAllToClipboard(clipboard, circuit, state.selected);
  } else {
    copyToClipboard(clipboard, circuit, state.selected);
  }
}

// Cut (Ctrl+X)
function handleCut() {
  if (!state.selected) return;
  
  if (Array.isArray(state.selected)) {
    // Copy dan delete semua item yang dipilih
    copyAllToClipboard(clipboard, circuit, state.selected);
    saveToHistory();
    for (const s of state.selected) {
      if (s.kind === "component") removeComponent(circuit, s.id);
      else if (s.kind === "junction") removeJunction(circuit, s.id);
      else if (s.kind === "wire") removeWire(circuit, s.id);
    }
    state.selected = null;
    refresh();
  } else {
    copyToClipboard(clipboard, circuit, state.selected);
    saveToHistory();
    const actions = {
      deleteSelection() {
        const s = state.selected;
        if (!s) return;
        if (s.kind === "component") removeComponent(circuit, s.id);
        else if (s.kind === "junction") removeJunction(circuit, s.id);
        else removeWire(circuit, s.id);
        state.selected = null;
        refresh();
      },
    };
    actions.deleteSelection();
  }
}

// Paste (Ctrl+V)
function handlePaste() {
  const clipData = getClipboardData(clipboard);
  if (!clipData) return;

  saveToHistory();

  const idMap = { component: {}, junction: {} };
  const newComponents = [];
  const newJunctions = [];
  const newWires = [];

  // Paste components dengan offset
  for (const comp of clipData.components) {
    const oldId = comp.id;
    const newComp = {
      ...comp,
      id: `c${circuit.nextId++}`,
      x: comp.x + 40,
      y: comp.y + 40,
    };
    idMap.component[oldId] = newComp.id;
    newComponents.push(newComp);
    circuit.components.push(newComp);
  }

  // Paste junctions dengan offset
  for (const junction of clipData.junctions) {
    const oldId = junction.id;
    const newJunction = {
      ...junction,
      id: `j${circuit.nextJunctionId++}`,
      x: junction.x + 40,
      y: junction.y + 40,
    };
    idMap.junction[oldId] = newJunction.id;
    newJunctions.push(newJunction);
    circuit.junctions.push(newJunction);
  }

  // Paste wires dengan id mapping
  for (const wire of clipData.wires) {
    const newWire = {
      ...wire,
      id: `w${circuit.nextWireId++}`,
      from: { ...wire.from },
      to: { ...wire.to },
    };
    
    if (wire.from.component && idMap.component[wire.from.component]) {
      newWire.from.component = idMap.component[wire.from.component];
    }
    if (wire.from.junction && idMap.junction[wire.from.junction]) {
      newWire.from.junction = idMap.junction[wire.from.junction];
    }
    
    if (wire.to.component && idMap.component[wire.to.component]) {
      newWire.to.component = idMap.component[wire.to.component];
    }
    if (wire.to.junction && idMap.junction[wire.to.junction]) {
      newWire.to.junction = idMap.junction[wire.to.junction];
    }
    
    newWires.push(newWire);
    circuit.wires.push(newWire);
  }

  // Pilih komponen pertama yang di-paste
  if (newComponents.length > 0) {
    state.selected = { kind: "component", id: newComponents[0].id };
  }

  refresh();
}

// Select All (Ctrl+A)
function handleSelectAll() {
  // Select semua item
  const allSelections = [];
  circuit.components.forEach(c => allSelections.push({ kind: "component", id: c.id }));
  circuit.junctions.forEach(j => allSelections.push({ kind: "junction", id: j.id }));
  circuit.wires.forEach(w => allSelections.push({ kind: "wire", id: w.id }));

  if (allSelections.length > 0) {
    // Since UI doesn't yet support multiple selection, we use an array state
    // For now, take the first item's ID and add logic for all later
    // Currently, update state so UI knows all are selected (if logic supports it)
    // Update: UI `canvas.js` and `interaction.js` need to support array `selected`
    // Given limitations, we select all by marking `state.selected` as an array
    state.selected = allSelections;
    refresh();
  }
}

const actions = {
  deleteSelection() {
    const s = state.selected;
    if (!s) return;
    
    if (Array.isArray(s)) {
      saveToHistory();
      for (const item of s) {
        if (item.kind === "component") removeComponent(circuit, item.id);
        else if (item.kind === "junction") removeJunction(circuit, item.id);
        else if (item.kind === "wire") removeWire(circuit, item.id);
      }
      state.selected = null;
      refresh();
    } else {
      saveToHistory();
      if (s.kind === "component") removeComponent(circuit, s.id);
      else if (s.kind === "junction") removeJunction(circuit, s.id);
      else removeWire(circuit, s.id);
      state.selected = null;
      refresh();
    }
  },
  rotateSelection() {
    const s = state.selected;
    const component = s?.kind === "component" && findComponent(circuit, s.id);
    if (!component) return;
    saveToHistory();
    rotateComponent(component);
    refresh({ panel: false });
  },
};

const properties = createProperties(document.getElementById("properties-panel"), circuit, {
  getSelection: () => state.selected,
  onParamChangeStart: () => saveToHistory(),
  onParamChange: () => refresh({ panel: false }),
  onRotate: actions.rotateSelection,
  onDelete: actions.deleteSelection,
});

// Dipanggil saat komponen dilepas di kanvas (point) atau di-klik (point = null).
function place(type, point) {
  saveToHistory();
  const spot = point || findFreeSpot(circuit);
  const component = addComponent(circuit, type, spot.x, spot.y);
  state.selected = { kind: "component", id: component.id };
  refresh();
}

setupPalette(document.getElementById("palette"), canvas, place);
setHistoryCallback(saveToHistory);
setupInteraction({
  svg: document.getElementById("sim-canvas"),
  canvas,
  circuit,
  state,
  refresh,
  actions,
  keyboardActions: {
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleSelectAll,
  },
});

setupProjectTools({ history, circuit });

// Run/Stop button: starts or stops the live simulation.
runButton.addEventListener("click", () => {
  state.running = !state.running;
  runButton.textContent = state.running ? "\u25a0 Stop Simulation" : "\u25b6 Run Simulation";
  refresh({ panel: false });
});

document.getElementById("sim-clear").addEventListener("click", () => {
  const isEmpty = circuit.components.length === 0;
  if (isEmpty || window.confirm("Remove all components from the canvas?")) {
    saveToHistory();
    clearCircuit(circuit);
    state.selected = null;
    refresh();
  }
});

// Used to inspect circuit data from Console and later by Projects.
window.ElectroLabCircuit = {
  getData: () => getCircuitData(circuit),
  simulate: () => simulate(circuit),
};

refresh();
saveToHistory(); // Save initial state (empty circuit)

// Cek apakah ada query parameter ?proj= atau ?new=
(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projId = urlParams.get('proj');
  const newProjName = urlParams.get('new');

  if (newProjName) {
    // Create a new project with the given name
    const initialCircuit = getCircuitData(circuit);
    const initialHistory = {
      snapshots: [initialCircuit],
      currentIndex: 0
    };
    const newId = await createProject(newProjName, initialCircuit, initialHistory);
    // Change URL with project ID so auto-save works
    const newUrl = window.location.pathname + "?proj=" + newId;
    window.history.replaceState({}, document.title, newUrl);
  } else if (projId) {
    // Load proyek dari API
    const saved = await getProject(projId);
    if (saved) {
      restoreFromSnapshot(saved.circuit);
      // Restore history
      history.snapshots = saved.history?.snapshots || [];
      history.currentIndex = saved.history?.currentIndex ?? -1;
    }
  }
})();
