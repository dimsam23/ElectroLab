// Menggambar rangkaian ke dalam elemen <svg> dan mengubah posisi mouse menjadi koordinat kanvas.

import { COMPONENT_TYPES, CANVAS_WIDTH, CANVAS_HEIGHT } from "./components.js";
import { endKey } from "./circuit.js";
import { wirePoints } from "./wiring.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Membuat elemen SVG dengan atribut tertentu.
export function svgEl(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (parent) parent.appendChild(node);
  return node;
}

// Menggambar daftar bentuk (data dari components.js) ke dalam elemen induk.
export function drawShapes(parent, shapes) {
  for (const shape of shapes) {
    const { tag, text, ...attrs } = shape;
    if (!attrs.class) attrs.class = tag === "text" ? "sym-text" : "sym";
    const node = svgEl(tag, attrs, parent);
    if (text !== undefined) node.textContent = text;
  }
}

// view = status tampilan: { selected, snap, preview, results }
// selected: { kind: "component" | "junction" | "wire", id } atau null
// snap: ujung yang sedang disorot saat kabel ditarik, atau null
// results: hasil simulasi (lihat solver.js) atau null kalau simulasi tidak berjalan
function drawComponent(layer, component, connected, view) {
  const definition = COMPONENT_TYPES[component.type];
  const result = view.results?.components?.[component.id];
  const isSelected = Array.isArray(view.selected)
    ? view.selected.some((s) => s.kind === "component" && s.id === component.id)
    : view.selected?.kind === "component" && view.selected.id === component.id;

  const classes = ["component"];
  if (isSelected) classes.push("selected");
  if (result?.lit) classes.push("lit"); // LED menyala
  if (result?.conducting) classes.push("conducting"); // dioda / transistor sedang menghantar
  if (result?.overcurrent) classes.push("overcurrent");
  const group = svgEl("g", { class: classes.join(" "), "data-component-id": component.id }, layer);

  // Bagian yang ikut berputar: area klik, simbol, dan terminal.
  const body = svgEl(
    "g",
    { transform: `translate(${component.x} ${component.y}) rotate(${component.rotation})` },
    group
  );
  const hit = definition.hitArea || { x: -44, y: -30, width: 88, height: 60 };
  svgEl("rect", { class: "hit-area", ...hit, rx: 8 }, body);
  drawShapes(body, definition.shapes(component));

  for (const [name, [x, y]] of Object.entries(definition.terminals)) {
    const key = `${component.id}:${name}`;
    const isSnap = view.snap && endKey(view.snap) === key;
    const terminalClasses = ["terminal"];
    if (connected.has(key)) terminalClasses.push("connected");
    if (isSnap) terminalClasses.push("snap");
    // Lingkaran transparan yang lebih besar supaya terminal mudah ditekan (terutama di layar sentuh).
    svgEl("circle", { class: "terminal-hit", cx: x, cy: y, r: 11, "data-terminal": name }, body);
    svgEl(
      "circle",
      { class: terminalClasses.join(" "), cx: x, cy: y, r: isSnap ? 7 : 5, "data-terminal": name },
      body
    );
  }

  // Keterangan nilai (misalnya "9 V") tetap tegak walaupun komponen diputar.
  const caption = definition.caption(component);
  if (caption) {
    const label = svgEl(
      "text",
      { class: "comp-label", x: component.x, y: component.y + (definition.labelY ?? 38) },
      group
    );
    label.textContent = caption;
  }

  // Indikator visual seleksi komponen (dihapus badge/kotak)
  if (isSelected) {
  }

  // Angka hasil ukur multimeter (muncul saat simulasi berjalan).
  if (result?.display) {
    const reading = svgEl(
      "text",
      { class: "comp-reading", x: component.x, y: component.y + (definition.labelY ?? 38) + 18 },
      group
    );
    reading.textContent = result.display;
  }
}

function drawJunction(layer, junction, view) {
  const isSelected = Array.isArray(view.selected)
    ? view.selected.some((s) => s.kind === "junction" && s.id === junction.id)
    : view.selected?.kind === "junction" && view.selected.id === junction.id;
  const isSnap = view.snap && endKey(view.snap) === `junction:${junction.id}`;
  const group = svgEl(
    "g",
    {
      class: isSelected ? "junction selected" : "junction",
      "data-junction-id": junction.id,
    },
    layer
  );
  svgEl("circle", { class: "terminal-hit", cx: junction.x, cy: junction.y, r: 11 }, group);
  svgEl(
    "circle",
    {
      class: isSnap ? "junction-dot snap" : "junction-dot",
      cx: junction.x,
      cy: junction.y,
      r: isSnap ? 7 : 5,
    },
    group
  );

  // Tambahkan badge [SELECTED] jika junction terpilih
  
}

const toPointsAttr = (points) => points.map((p) => `${p.x},${p.y}`).join(" ");

function drawWire(layer, circuit, wire, view) {
  const points = wirePoints(circuit, wire);
  if (!points) return;
  const isSelected = Array.isArray(view.selected)
    ? view.selected.some((s) => s.kind === "wire" && s.id === wire.id)
    : view.selected?.kind === "wire" && view.selected.id === wire.id;

  // Detect arus dari hasil simulasi
  // Detect arus dari hasil simulasi
  const hasCurrent = view.results?.wires?.[wire.id]?.current > 0;
  const classes = ["wire"];
  if (hasCurrent) classes.push("current-flow");

  const group = svgEl(
    "g",
    { class: isSelected ? "wire-group selected" : "wire-group", "data-wire-id": wire.id },
    layer
  );
  // Garis tebal transparan = area klik
  svgEl("polyline", { class: "wire-hit", points: toPointsAttr(points) }, group);
  svgEl("polyline", { class: classes.join(" "), points: toPointsAttr(points) }, group);

  // Jika wire terpilih (multiple), cukup tampilkan badge visual (dihapus)
  if (isSelected && Array.isArray(view.selected)) {
    // no badge
  }
}

export function createCanvas(svg) {
  // Tambahkan stylesheet untuk animasi partikel arus mengalir jika belum ada
  if (!document.getElementById("current-flow-style")) {
    const style = document.createElement("style");
    style.id = "current-flow-style";
    style.textContent = `
      @keyframes flowParticles {
        from { stroke-dashoffset: 16; }
        to { stroke-dashoffset: 0; }
      }
      .wire.conducting {
        stroke: #22c55e !important;
        stroke-width: 3px;
      }
      .wire.current-flow {
        stroke: #ef4444 !important;
        stroke-width: 3px;
        stroke-dasharray: 4, 12;
        animation: flowParticles 0.6s linear infinite;
      }
    `;
    document.head.appendChild(style);
  }

  const wiresLayer = svg.querySelector("#wires-layer");
  const componentsLayer = svg.querySelector("#components-layer");
  const previewLayer = svg.querySelector("#preview-layer");
  const emptyHint = svg.querySelector("#empty-hint");

  // Menggambar ulang seluruh rangkaian. Rangkaian kecil, jadi cukup cepat.
  function render(circuit, view = {}) {
    const connected = new Set();
    for (const wire of circuit.wires) {
      connected.add(endKey(wire.from));
      connected.add(endKey(wire.to));
    }

    wiresLayer.replaceChildren();
    for (const wire of circuit.wires) drawWire(wiresLayer, circuit, wire, view);

    componentsLayer.replaceChildren();
    for (const component of circuit.components) {
      drawComponent(componentsLayer, component, connected, view);
    }
    for (const junction of circuit.junctions) drawJunction(componentsLayer, junction, view);

    previewLayer.replaceChildren();
    if (view.preview) {
      svgEl("polyline", { class: "wire preview", points: toPointsAttr(view.preview.points) }, previewLayer);
    }

    const isEmpty = circuit.components.length === 0;
    emptyHint.style.display = isEmpty ? "" : "none";
  }

  // Mengubah posisi mouse di layar menjadi koordinat kanvas (0..1000, 0..600).
  function toCanvasPoint(clientX, clientY) {
    const box = svg.getBoundingClientRect();
    return {
      x: ((clientX - box.left) / box.width) * CANVAS_WIDTH,
      y: ((clientY - box.top) / box.height) * CANVAS_HEIGHT,
    };
  }

  // Apakah titik layar berada di atas kanvas?
  function isOver(clientX, clientY) {
    const box = svg.getBoundingClientRect();
    return (
      clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom
    );
  }

  let zoom = 1;
  let viewBoxX = 0;
  let viewBoxY = 0;
  let viewBoxW = CANVAS_WIDTH;
  let viewBoxH = CANVAS_HEIGHT;

  function updateViewBox() {
    const scale = zoom * 100;
    const zoomLevelEl = document.getElementById("zoom-level");
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(scale)}%`;
    svg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`);
  }

  function handleZoom(delta, centerX = 500, centerY = 300) {
    const oldZoom = zoom;
    zoom = Math.min(Math.max(zoom + delta, 0.5), 3);
    if (zoom === oldZoom) return;

    const newW = CANVAS_WIDTH / zoom;
    const newH = CANVAS_HEIGHT / zoom;

    // Posisikan zoom di tengah
    const x = (CANVAS_WIDTH - newW) / 2;
    const y = (CANVAS_HEIGHT - newH) / 2;
    viewBoxX = x;
    viewBoxY = y;
    viewBoxW = newW;
    viewBoxH = newH;

    updateViewBox();
  }

  // Pan / geser canvas dengan drag (klik kanan atau middle click, atau dengan tombol shift+klik kiri, atau tool pan)
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  svg.addEventListener("pointerdown", (e) => {
    // Tombol tengah (1) atau klik kanan (2) atau shift+klik kiri untuk pan canvas
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      svg.setPointerCapture(e.pointerId);
    }
  });

  svg.addEventListener("pointermove", (e) => {
    if (!isPanning) return;
    e.preventDefault();
    const dx = (e.clientX - panStart.x) * (viewBoxW / svg.clientWidth);
    const dy = (e.clientY - panStart.y) * (viewBoxH / svg.clientHeight);
    viewBoxX -= dx;
    viewBoxY -= dy;
    panStart = { x: e.clientX, y: e.clientY };
    updateViewBox();
  });

  svg.addEventListener("pointerup", (e) => {
    if (isPanning) {
      isPanning = false;
      try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  });

  svg.addEventListener("contextmenu", (e) => {
    if (e.button === 2) e.preventDefault(); // cegah context menu saat pan dengan klik kanan
  });

  // Perbaiki toCanvasPoint agar akurat dengan viewBox yang bergeser/zoom
  function toCanvasPoint(clientX, clientY) {
    const box = svg.getBoundingClientRect();
    const xRatio = (clientX - box.left) / box.width;
    const yRatio = (clientY - box.top) / box.height;
    return {
      x: viewBoxX + xRatio * viewBoxW,
      y: viewBoxY + yRatio * viewBoxH,
    };
  }

  // Mouse wheel zoom
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
  }, { passive: false });

  // Touch zoom (pinch gesture)
  let lastDist = 0;
  svg.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist > 0) {
        handleZoom((dist - lastDist) / 500);
      }
      lastDist = dist;
    }
  });
  svg.addEventListener("touchend", () => lastDist = 0);

  // Event listeners untuk toolbar
  document.getElementById("zoom-in")?.addEventListener("click", () => handleZoom(0.1));
  document.getElementById("zoom-out")?.addEventListener("click", () => handleZoom(-0.1));
  document.getElementById("zoom-reset")?.addEventListener("click", () => {
    zoom = 1;
    viewBoxX = 0;
    viewBoxY = 0;
    viewBoxW = CANVAS_WIDTH;
    viewBoxH = CANVAS_HEIGHT;
    updateViewBox();
  });

  return { render, toCanvasPoint, isOver };
}